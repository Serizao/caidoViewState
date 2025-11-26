/**
 * Tests pour le ViewState Parser
 * Portés depuis les tests Java de ViewStateDecoder
 */

import { describe, it, expect } from 'vitest';
import { parseViewState, ViewStateParser } from './viewstate-module';

describe('ViewStateParser', () => {
  
  describe('Basic Parser Tests', () => {
    
    it('Testcase1 - should parse bool true', () => {
      const viewState = '/wFn';
      const result = parseViewState(viewState);
      
      console.log('Testcase1:', JSON.stringify(result.json, null, 2));
      
      expect(result.encrypted).toBe(false);
      expect(result.mac).toBe(false);
      expect(result.json).toHaveProperty('bool', true);
    });

    it('Testcase2 - should parse Int32 = 136', () => {
      const viewState = '/wECiAE=';
      const result = parseViewState(viewState);
      
      console.log('Testcase2:', JSON.stringify(result.json, null, 2));
      
      expect(result.encrypted).toBe(false);
      expect(result.mac).toBe(false);
      expect(result.json).toHaveProperty('Int32', 136);
    });

    it('Testcase3 - should parse string "abcdefghij"', () => {
      // bytes: 0xff, 0x01, 0x05, 0x0a, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'
      const viewState = '/wEFCmFiY2RlZmdoaWo=';
      const result = parseViewState(viewState);
      
      console.log('Testcase3:', JSON.stringify(result.json, null, 2));
      
      expect(result.encrypted).toBe(false);
      expect(result.mac).toBe(false);
      expect(result.json).toHaveProperty('string', 'abcdefghij');
    });

    it('Testcase4 - should parse Hashtable', () => {
      // bytes: 0xff, 0x01, 0x18, 0x02, 0x05, 0x1a, 0x05, 0x1b, 0x05, 0x1c, 0x05, 0x1d
      const viewState = '/wEYAgUaBRsFHAUd';
      const result = parseViewState(viewState);
      
      console.log('Testcase4:', JSON.stringify(result.json, null, 2));
      
      expect(result.encrypted).toBe(false);
      expect(result.mac).toBe(false);
      expect(result.json).toHaveProperty('Hashtable');
    });

  });

  describe('ViewState with Structure Tests', () => {

    it('Parser01 - should parse Pair with string "-342523369"', () => {
      const viewState = '/wEPDwUKLTM0MjUyMzM2OWRkmW75zyss5UROsLtrTEuOq7AGUDk=';
      const result = parseViewState(viewState);
      
      console.log('Parser01:', JSON.stringify(result.json, null, 2));
      
      expect(result.encrypted).toBe(false);
      
      // Navigate through the structure: Pair -> [0] -> Pair -> [0] -> string
      const pair = result.json?.Pair;
      expect(pair).toBeDefined();
      expect(Array.isArray(pair)).toBe(true);
      
      const innerPair = pair[0]?.Pair;
      expect(innerPair).toBeDefined();
      
      const stringValue = innerPair[0]?.string;
      expect(stringValue).toBe('-342523369');
      
      // Check digest (20 bytes = SHA1, but marked as HMAC_UNKNOWN in Java tests)
      expect(result.digest).toBe('996ef9cf2b2ce5444eb0bb6b4c4b8eabb0065039');
    });

    it('Parser02 - should parse with detail mode and have digest', () => {
      const viewState = '/wEPDwUENTM4MWRkhsjF+62gWnhYUcEyuRwTHxGDVzA=';
      const parser = new ViewStateParser({ detail: true });
      const result = parser.parse(viewState);
      
      console.log('Parser02:', JSON.stringify(result.json, null, 2));
      
      expect(result.encrypted).toBe(false);
      expect(result.digest).toBe('86c8c5fbada05a785851c132b91c131f11835730');
    });

    it('Parser03 - should parse ArrayList', () => {
      // Simple ArrayList test: 0xff 0x01 0x16 0x02 0x67 0x68 = ArrayList with [true, false]
      const viewState = '/wEWAmdo';
      const result = parseViewState(viewState);
      
      console.log('Parser03:', JSON.stringify(result.json, null, 2));
      
      expect(result.encrypted).toBe(false);
      expect(result.json).toHaveProperty('ArrayList');
      expect(result.json.ArrayList).toHaveLength(2);
      expect(result.json.ArrayList[0]).toHaveProperty('bool', true);
      expect(result.json.ArrayList[1]).toHaveProperty('bool', false);
    });

  });

  describe('Encrypted ViewState Tests', () => {

    it('Parser20 - should throw error for invalid ViewState with extra params', () => {
      const viewStateB64 = '/wEPDwUENTM4MWRkhsjF+62gWnhYUcEyuRwTHxGDVzA=&__EVENT=xxxxx';
      
      // This should throw an error because the base64 is invalid (contains &)
      expect(() => {
        parseViewState(viewStateB64);
      }).toThrow();
    });

    it('Parser21 - should detect encrypted ViewState', () => {
      const viewStateB64 = 'ZU1VanBjYUFOWGlGcElTcGtwQ3dWSndXY3NtZ05XNEZscWtsOUlWcjlxV01iYUFOYW92eTJOSkh6MnNadmNCTG9kRGdBbTVrUWNhQ2ZKdnh0d0t0eUtLMmwzY29GMTY5UzR6WnpLY1JWUTEzaWhVNW12VG44YkllZmlGUjZSZTJ4ZDVkcEp2VVp5bDBpVEVucUdDaFVwdUlteTJsZ1VMRkpCRnZjWGRnUDJqTXRIdWsxVkJoZ0NSM01aQWd5NW5KUnVlbDlJbDF6Y1M3R21rS05ZV241bHhkOEJDSU1yVHJIRlBTSEl5SFVaWjhLNFFMRVF2QzZ5MmdvWG1STDBaRg==';
      const result = parseViewState(viewStateB64);
      
      console.log('Parser21:', JSON.stringify(result.json, null, 2));
      
      // This ViewState doesn't start with 0xFF 0x01, so it's detected as encrypted
      expect(result.encrypted).toBe(true);
    });

  });

  describe('MAC Algorithm Detection Tests', () => {

    it('should detect no MAC when digest is empty', () => {
      const viewState = '/wFn'; // Simple bool true, no MAC
      const result = parseViewState(viewState);
      
      expect(result.mac).toBe(false);
      expect(result.macAlgorithm).toBeNull();
      expect(result.digest).toBeNull();
    });

    it('should detect MAC with 20 bytes remaining (SHA1-like)', () => {
      // ViewState with 20 bytes at the end
      const viewState = '/wEPDwUKLTM0MjUyMzM2OWRkmW75zyss5UROsLtrTEuOq7AGUDk=';
      const result = parseViewState(viewState);
      
      // 20 bytes = could be SHA1 but parser reports as HMAC-UNKNOWN
      expect(result.mac).toBe(true);
      expect(result.digest).toBeDefined();
    });

  });

  describe('Data Type Parsing Tests', () => {

    it('should parse null token', () => {
      // 0xff 0x01 0x64 = null
      const viewState = '/wFk';
      const result = parseViewState(viewState);
      
      console.log('Null test:', JSON.stringify(result.json, null, 2));
      expect(result.json).toBeNull();
    });

    it('should parse empty string token', () => {
      // 0xff 0x01 0x65 = empty string
      const viewState = '/wFl';
      const result = parseViewState(viewState);
      
      console.log('Empty string test:', JSON.stringify(result.json, null, 2));
      expect(result.json).toHaveProperty('String', '');
    });

    it('should parse zero Int32 token', () => {
      // 0xff 0x01 0x66 = zero int32
      const viewState = '/wFm';
      const result = parseViewState(viewState);
      
      console.log('Zero Int32 test:', JSON.stringify(result.json, null, 2));
      expect(result.json).toHaveProperty('Int32', 0);
    });

    it('should parse bool true token', () => {
      // 0xff 0x01 0x67 = true
      const viewState = '/wFn';
      const result = parseViewState(viewState);
      
      console.log('Bool true test:', JSON.stringify(result.json, null, 2));
      expect(result.json).toHaveProperty('bool', true);
    });

    it('should parse bool false token', () => {
      // 0xff 0x01 0x68 = false
      const viewState = '/wFo';
      const result = parseViewState(viewState);
      
      console.log('Bool false test:', JSON.stringify(result.json, null, 2));
      expect(result.json).toHaveProperty('bool', false);
    });

  });

});

