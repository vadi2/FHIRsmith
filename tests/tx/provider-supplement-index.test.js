const { Provider } = require('../../tx/provider');
const { CodeSystem } = require('../../tx/library/codesystem');

/**
 * loadSupplements only looks at the supplements filed under the code system they supplement
 * (the part of their supplements element before any '|'), not at every code system the
 * provider has. It must find the same supplements as going through all of them, and keep
 * up when code systems are added or deleted.
 */

const LANG_PACK = { url: 'http://hl7.org/fhir/StructureDefinition/codesystem-supplement-type', valueCode: 'lang-pack' };

function supplement(url, version, supplements, langPack = true) {
  return new CodeSystem({
    resourceType: 'CodeSystem', url, version, status: 'active', content: 'supplement', supplements,
    extension: langPack ? [LANG_PACK] : undefined
  });
}

function complete(url, version) {
  return new CodeSystem({ resourceType: 'CodeSystem', url, version, status: 'active', content: 'complete' });
}

function newProvider(...systems) {
  const p = Object.create(Provider.prototype);
  p.codeSystems = new Map();
  p.codeSystemFactories = new Map();
  for (const s of systems) p.addCodeSystem(s);
  return p;
}

function urls(list) {
  return list.map(cs => cs.vurl);
}

describe('Provider.loadSupplements', () => {
  test('finds supplements by url and by url|version, and ignores other code systems', () => {
    const p = newProvider(
      complete('http://ex.org/cs', '1.0'),
      supplement('http://ex.org/s1', '1', 'http://ex.org/cs'),
      supplement('http://ex.org/s2', '1', 'http://ex.org/cs|1.0'),
      supplement('http://ex.org/s3', '1', 'http://ex.org/cs|2.0'),
      supplement('http://ex.org/s4', '1', 'http://ex.org/other'),
      supplement('http://ex.org/s5', '1', 'http://ex.org/cs-extra')
    );
    expect(urls(p.loadSupplements('http://ex.org/cs', '1.0'))).toEqual(['http://ex.org/s1|1', 'http://ex.org/s2|1']);
    expect(urls(p.loadSupplements('http://ex.org/cs', '2.0'))).toEqual(['http://ex.org/s1|1', 'http://ex.org/s3|1']);
    expect(urls(p.loadSupplements('http://ex.org/other', '1'))).toEqual(['http://ex.org/s4|1']);
    expect(p.loadSupplements('http://ex.org/none', '1')).toEqual([]);
  });

  test('finds a supplement for url|version when asked about url|version', () => {
    const p = newProvider(
      supplement('http://ex.org/s1', '1', 'http://ex.org/cs|1.0'),
      supplement('http://ex.org/s2', '1', 'http://ex.org/cs|2.0'),
      supplement('http://ex.org/s3', '1', 'http://ex.org/cs')
    );
    expect(urls(p.loadSupplements('http://ex.org/cs|1.0', '1.0'))).toEqual(['http://ex.org/s1|1']);
    expect(p.loadSupplements('http://ex.org/cs|3.0', '3.0')).toEqual([]);
  });

  test('a supplement that is not a language pack is only used when stated', () => {
    const p = newProvider(supplement('http://ex.org/s1', '1', 'http://ex.org/cs', false));
    expect(p.loadSupplements('http://ex.org/cs', '1', null)).toEqual([]);
    expect(urls(p.loadSupplements('http://ex.org/cs', '1', ['http://ex.org/s1']))).toEqual(['http://ex.org/s1|1']);
  });

  test('sees code systems added and deleted after the first call', () => {
    const s1 = supplement('http://ex.org/s1', '1', 'http://ex.org/cs');
    const s2 = supplement('http://ex.org/s2', '1', 'http://ex.org/cs');
    const p = newProvider(s1);
    expect(urls(p.loadSupplements('http://ex.org/cs', '1'))).toEqual(['http://ex.org/s1|1']);
    p.addCodeSystem(s2);
    expect(urls(p.loadSupplements('http://ex.org/cs', '1'))).toEqual(['http://ex.org/s1|1', 'http://ex.org/s2|1']);
    p.deleteCodeSystem(s1);
    expect(urls(p.loadSupplements('http://ex.org/cs', '1'))).toEqual(['http://ex.org/s2|1']);
  });

  test('sees a replaced codeSystems map', () => {
    const p = newProvider(supplement('http://ex.org/s1', '1', 'http://ex.org/cs'));
    expect(urls(p.loadSupplements('http://ex.org/cs', '1'))).toEqual(['http://ex.org/s1|1']);
    p.codeSystems = new Map();
    expect(p.loadSupplements('http://ex.org/cs', '1')).toEqual([]);
  });
});
