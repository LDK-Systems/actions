import { describe, it, expect } from 'vitest';
import { parseXmlDocument, parseXmlElement } from '../src/xml';

describe('parseXmlDocument', () => {
  it('parses valid XML and returns document object', () => {
    const xml = '<root><child>hello</child></root>';
    const result = parseXmlDocument(xml);
    expect(result).toHaveProperty('root');
    expect((result.root as Record<string, unknown>).child).toBe('hello');
  });

  it('throws on invalid XML (no tags)', () => {
    expect(() => parseXmlDocument('not xml at all')).toThrow('not valid XML');
  });

  it('throws on empty string', () => {
    expect(() => parseXmlDocument('')).toThrow('Failed to parse XML');
  });

  it('handles self-closing tags', () => {
    const xml = '<root><empty/></root>';
    const result = parseXmlDocument(xml);
    expect(result).toHaveProperty('root');
  });

  it('handles nested elements', () => {
    const xml = '<Project><PropertyGroup><Version>1.2.3</Version></PropertyGroup></Project>';
    const result = parseXmlDocument(xml);
    expect(result).toHaveProperty('Project');
  });
});

describe('parseXmlElement', () => {
  it('extracts text content of an existing element', () => {
    const xml = '<Project><PropertyGroup><Version>1.2.3</Version></PropertyGroup></Project>';
    const result = parseXmlElement(xml, 'Version');
    expect(result).toBe('1.2.3');
  });

  it('returns undefined for non-existing element', () => {
    const xml = '<Project><PropertyGroup><Version>1.2.3</Version></PropertyGroup></Project>';
    const result = parseXmlElement(xml, 'NonExistent');
    expect(result).toBeUndefined();
  });

  it('extracts deeply nested elements', () => {
    const xml = '<a><b><c><d>deep</d></c></b></a>';
    const result = parseXmlElement(xml, 'd');
    expect(result).toBe('deep');
  });

  it('returns string representation of numeric content', () => {
    const xml = '<root><count>42</count></root>';
    const result = parseXmlElement(xml, 'count');
    expect(result).toBe('42');
  });

  it('throws on invalid XML input', () => {
    expect(() => parseXmlElement('not xml', 'tag')).toThrow();
  });

  it('handles typical .csproj version extraction', () => {
    const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Version>2.0.1</Version>
    <VersionPrefix>2.0</VersionPrefix>
    <VersionSuffix>beta</VersionSuffix>
  </PropertyGroup>
</Project>`;
    expect(parseXmlElement(csproj, 'Version')).toBe('2.0.1');
    expect(parseXmlElement(csproj, 'VersionPrefix')).toBe('2.0');
    expect(parseXmlElement(csproj, 'VersionSuffix')).toBe('beta');
    expect(parseXmlElement(csproj, 'TargetFramework')).toBe('net8.0');
  });
});
