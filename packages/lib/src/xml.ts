import { XMLParser } from 'fast-xml-parser';

/**
 * Options for XML parsing configuration.
 */
export interface ParseOptions {
  ignoreAttributes?: boolean;
}

/**
 * Parses an XML string and returns the parsed document object.
 * Throws if the input is not valid XML.
 * @param xml - XML string to parse
 * @param options - Optional parsing configuration
 * @returns The parsed document as a record object
 */
export function parseXmlDocument(xml: string, options?: ParseOptions): Record<string, unknown> {
  const parser = new XMLParser({
    ignoreAttributes: options?.ignoreAttributes ?? true,
    parseTagValue: false, // Preserve all values as strings
  });

  let result: Record<string, unknown>;
  try {
    result = parser.parse(xml) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to parse XML: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // fast-xml-parser doesn't throw on non-XML strings by default;
  // it may return a string or unexpected result. Validate the input is actual XML.
  if (typeof xml !== 'string' || xml.trim() === '') {
    throw new Error('Failed to parse XML: input is empty or not a string');
  }

  // Check if the input looks like XML (has at least one tag)
  if (!/<[a-zA-Z_][\w.-]*[\s>/]/.test(xml)) {
    throw new Error('Failed to parse XML: input is not valid XML');
  }

  return result;
}

/**
 * Extracts the text content of a specific element by tag name
 * from a well-formed XML document string.
 * Returns undefined if the element is not found.
 * @param xml - XML string to search
 * @param tagName - Element tag name to find
 * @returns The text content of the element, or undefined if not found
 */
export function parseXmlElement(xml: string, tagName: string): string | undefined {
  const doc = parseXmlDocument(xml);
  const value = findElement(doc, tagName);
  if (value === undefined) {
    return undefined;
  }
  return String(value);
}

/**
 * Recursively searches a parsed XML document for an element with the given tag name.
 * Returns the value of the first matching element, or undefined if not found.
 * @param obj - The parsed XML object to search
 * @param tagName - Element tag name to find
 * @returns The value of the matching element, or undefined if not found
 */
function findElement(obj: unknown, tagName: string): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return undefined;
  }

  const record = obj as Record<string, unknown>;

  if (tagName in record) {
    return record[tagName];
  }

  for (const key of Object.keys(record)) {
    const child = record[key];
    if (typeof child === 'object' && child !== null) {
      const found = findElement(child, tagName);
      if (found !== undefined) {
        return found;
      }
    }
  }

  return undefined;
}
