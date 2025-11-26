/**
 * ViewState Parser pour navigateur
 * Port du code Java de ViewStateDecoder (https://github.com/raise-isayan/ViewStateDecoder)
 * Basé sur le format ObjectStateFormatter de .NET
 * @see https://github.com/mono/mono/blob/master/mcs/class/referencesource/System.Web/UI/ObjectStateFormatter.cs
 * @license MIT
 */

// ============================================================================
// Constantes de tokens (identiques au code Java)
// ============================================================================

export const Token = {
  Int16: 0x01,
  Int32: 0x02,
  Byte: 0x03,
  Char: 0x04,
  String: 0x05,
  DateTime: 0x06,
  Double: 0x07,
  Single: 0x08,
  Color: 0x09,
  KnownColor: 0x0a,
  IntEnum: 0x0b,
  EmptyColor: 0x0c,
  Pair: 0x0f,
  Triplet: 0x10,
  Array: 0x14,
  StringArray: 0x15,
  ArrayList: 0x16,
  Hashtable: 0x17,
  HybridDictionary: 0x18,
  Type: 0x19,
  Unit: 0x1b,
  EmptyUnit: 0x1c,
  EventValidationStore: 0x1d,
  IndexedStringAdd: 0x1e,
  IndexedString: 0x1f,
  StringFormatted: 0x28,
  TypeRefAdd: 0x29,
  TypeRefAddLocal: 0x2a,
  TypeRef: 0x2b,
  BinarySerialized: 0x32,
  SparseArray: 0x3c,
  Null: 0x64,
  EmptyString: 0x65,
  ZeroInt32: 0x66,
  True: 0x67,
  False: 0x68,
} as const;

export const Marker = {
  Format: 0xff,
  Version1: 0x01,
} as const;

const HASH_SIZE_IN_BYTES = 16; // 128 / 8

const UNIT_TYPES = [
  'pixel',      // 1
  'point',      // 2
  'pica',       // 3
  'inch',       // 4
  'mm',         // 5
  'cm',         // 6
  'percentage', // 7
  'em',         // 8
  'ex',         // 9
];

const KNOWN_TYPES = ['Object', 'int', 'string', 'bool'];

// ============================================================================
// Classe ByteBuffer (lecture Little Endian) - Version navigateur
// ============================================================================

class ByteBuffer {
  private buffer: Uint8Array;
  public offset: number;

  constructor(buffer: Uint8Array) {
    this.buffer = buffer;
    this.offset = 0;
  }

  remaining(): number {
    return this.buffer.length - this.offset;
  }

  get(): number {
    if (this.offset >= this.buffer.length) {
      throw new Error('Buffer underflow');
    }
    return this.buffer[this.offset++];
  }

  getBytes(length: number): Uint8Array {
    if (this.offset + length > this.buffer.length) {
      throw new Error('Buffer underflow');
    }
    const bytes = this.buffer.slice(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }

  getShort(): number {
    // Little Endian
    const low = this.get();
    const high = this.get();
    let value = (high << 8) | low;
    // Signed
    if (value >= 0x8000) value -= 0x10000;
    return value;
  }

  getInt(): number {
    // Little Endian (4 bytes)
    const b0 = this.get();
    const b1 = this.get();
    const b2 = this.get();
    const b3 = this.get();
    const value = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    return value;
  }

  getLong(): bigint {
    // Little Endian (8 bytes) - retourne un BigInt pour précision
    const low = BigInt(this.getInt() >>> 0);
    const high = BigInt(this.getInt() >>> 0);
    return (high << 32n) | low;
  }

  getFloat(): number {
    const bytes = this.getBytes(4);
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return dataView.getFloat32(0, true); // true = little endian
  }

  getDouble(): number {
    const bytes = this.getBytes(8);
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return dataView.getFloat64(0, true); // true = little endian
  }
}

// ============================================================================
// Types d'export
// ============================================================================

export interface ViewStateParseResult {
  encrypted: boolean;
  mac: boolean;
  macAlgorithm: string | null;
  digest: string | null;
  json: any;
}

export interface ViewStateParserOptions {
  detail?: boolean;
  debug?: boolean;
}

// ============================================================================
// Classe ViewStateParser
// ============================================================================

export class ViewStateParser {
  private detail: boolean;
  private debug: boolean;
  private stringTable: string[];
  private typeTable: string[];

  constructor(options: ViewStateParserOptions = {}) {
    this.detail = options.detail || false;
    this.debug = options.debug || false;
    this.stringTable = [];
    this.typeTable = [];
  }

  /**
   * Parse une chaîne ViewState encodée en Base64
   */
  parse(viewStateBase64: string): ViewStateParseResult {
    // Normalisation (espaces, +)
    const normalized = viewStateBase64.replace(/\s+/g, '').replace(/ /g, '+');
    const buffer = base64ToUint8Array(normalized);
    const bbf = new ByteBuffer(buffer);

    // Reset tables
    this.stringTable = [];
    this.typeTable = [];

    const formatMarker = bbf.get();
    const versionMarker = bbf.get();

    if (formatMarker !== Marker.Format || versionMarker !== Marker.Version1) {
      // Probablement chiffré
      return {
        encrypted: true,
        mac: false,
        macAlgorithm: null,
        digest: null,
        json: { Encrypted: true },
      };
    }

    const json = this.decodeJsonObject(bbf);

    // HMAC restant
    const hmacLen = bbf.remaining();
    let digest: string | null = null;
    let macAlgorithm: string | null = null;
    let mac = false;

    if (hmacLen > 0) {
      const hmacBytes = bbf.getBytes(hmacLen);
      digest = uint8ArrayToHex(hmacBytes);
      mac = true;

      switch (hmacLen) {
        case 0x20:
          macAlgorithm = 'HMAC-SHA256';
          break;
        case 0x30:
          macAlgorithm = 'HMAC-SHA384';
          break;
        case 0x40:
          macAlgorithm = 'HMAC-SHA512';
          break;
        default:
          macAlgorithm = `HMAC-UNKNOWN(${hmacLen} bytes)`;
          break;
      }
    }

    return {
      encrypted: false,
      mac,
      macAlgorithm,
      digest,
      json,
    };
  }

  /**
   * Décode récursivement un objet JSON depuis le buffer
   */
  private decodeJsonObject(bbf: ByteBuffer): any {
    if (bbf.remaining() <= 0) {
      return null;
    }

    const token = bbf.get();

    if (this.debug) {
      console.log(`Token: 0x${token.toString(16).padStart(2, '0')}`);
    }

    try {
      switch (token) {
        case Token.Int16: {
          const value = bbf.getShort();
          return { Int16: value };
        }

        case Token.Int32: {
          const value = this.readEncodedInt32(bbf);
          return { Int32: value };
        }

        case Token.Byte: {
          const value = bbf.get();
          return { byte: value };
        }

        case Token.Char: {
          const value = bbf.get();
          return { char: String.fromCharCode(value) };
        }

        case Token.String: {
          const value = this.readString(bbf);
          return { string: value };
        }

        case Token.DateTime: {
          const dateBinary = bbf.getLong();
          return { DateTime: dateBinary.toString() };
        }

        case Token.Double: {
          const value = bbf.getDouble();
          return { Double: value };
        }

        case Token.Single: {
          const value = bbf.getFloat();
          return { Single: value };
        }

        case Token.Color: {
          const value = bbf.getInt() >>> 0;
          return { Color: value };
        }

        case Token.KnownColor: {
          const value = this.readEncodedInt32(bbf) >>> 0;
          return { KnownColor: value };
        }

        case Token.IntEnum: {
          const enumType = this.readTypeIdent(bbf);
          const enumValue = this.readEncodedInt32(bbf);
          return {
            IntEnum: {
              Type: enumType,
              Value: enumValue,
            },
          };
        }

        case Token.EmptyColor: {
          return { Color: null };
        }

        case Token.Pair: {
          if (this.detail) {
            const first = this.decodeJsonObject(bbf);
            const second = this.decodeJsonObject(bbf);
            const pairObj: any = {};
            if (first !== null) pairObj.First = first;
            if (second !== null) pairObj.Second = second;
            return { Pair: pairObj };
          } else {
            const first = this.decodeJsonObject(bbf);
            const second = this.decodeJsonObject(bbf);
            return { Pair: [first, second] };
          }
        }

        case Token.Triplet: {
          if (this.detail) {
            const first = this.decodeJsonObject(bbf);
            const second = this.decodeJsonObject(bbf);
            const third = this.decodeJsonObject(bbf);
            const tripletObj: any = {};
            if (first !== null) tripletObj.First = first;
            if (second !== null) tripletObj.Second = second;
            if (third !== null) tripletObj.Third = third;
            return { Triplet: tripletObj };
          } else {
            const first = this.decodeJsonObject(bbf);
            const second = this.decodeJsonObject(bbf);
            const third = this.decodeJsonObject(bbf);
            return { Triplet: [first, second, third] };
          }
        }

        case Token.Array: {
          const elementType = this.readTypeIdent(bbf);
          const count = this.readEncodedInt32(bbf);
          const array = [];
          for (let i = 0; i < count; i++) {
            array.push(this.decodeJsonObject(bbf));
          }
          return { [`Array ${elementType}`]: array };
        }

        case Token.StringArray: {
          const count = this.readEncodedInt32(bbf);
          const array = [];
          for (let i = 0; i < count; i++) {
            array.push(this.readString(bbf));
          }
          return { StringArray: array };
        }

        case Token.ArrayList: {
          const count = this.readEncodedInt32(bbf);
          const array = [];
          for (let i = 0; i < count; i++) {
            array.push(this.decodeJsonObject(bbf));
          }
          return { ArrayList: array };
        }

        case Token.Hashtable:
        case Token.HybridDictionary: {
          const count = this.readEncodedInt32(bbf);
          const entries = [];
          for (let i = 0; i < count; i++) {
            const key = this.decodeJsonObject(bbf);
            const value = this.decodeJsonObject(bbf);
            entries.push({ Key: key, Value: value });
          }
          return { Hashtable: entries };
        }

        case Token.Type: {
          const elementType = this.readTypeIdent(bbf);
          return { Type: elementType };
        }

        case Token.Unit: {
          const value = bbf.getDouble();
          const type = bbf.getInt();
          const unitStr = this.getUnitType(type);
          return { Unit: `${value.toFixed(2)} ${unitStr}` };
        }

        case Token.EmptyUnit: {
          return { Unit: null };
        }

        case Token.EventValidationStore: {
          const versionHeader = bbf.get();
          if (versionHeader !== 0) {
            throw new Error('Invalid Serialized Data (EventValidationStore)');
          }
          const count = this.readEncodedInt32(bbf);
          const events = [];
          for (let i = 0; i < count; i++) {
            if (bbf.remaining() >= HASH_SIZE_IN_BYTES) {
              const entry = bbf.getBytes(HASH_SIZE_IN_BYTES);
              events.push(uint8ArrayToHex(entry));
            } else {
              throw new Error('Invalid Serialized Data (EventValidationStore EOF)');
            }
          }
          return { EventValidationStore: events };
        }

        case Token.IndexedStringAdd: {
          const value = this.readString(bbf);
          this.stringTable.push(value);
          return { IndexedString: value };
        }

        case Token.IndexedString: {
          const tableIndex = bbf.get();
          const value =
            tableIndex < this.stringTable.length
              ? this.stringTable[tableIndex]
              : `stringReference:${tableIndex}`;
          return { IndexedString: value };
        }

        case Token.StringFormatted: {
          const elementType = this.readTypeIdent(bbf);
          const formattedValue = this.readString(bbf);
          return {
            StringFormatted: {
              Type: elementType,
              Formatted: formattedValue,
            },
          };
        }

        case Token.BinarySerialized: {
          const count = this.readEncodedInt32(bbf);
          const array = bbf.getBytes(count);
          // On retourne en base64 pour lisibilité
          return { BinarySerialized: uint8ArrayToBase64(array), byteLength: count };
        }

        case Token.SparseArray: {
          const elementType = this.readTypeIdent(bbf);
          const count = this.readEncodedInt32(bbf);
          const itemCount = this.readEncodedInt32(bbf);
          if (itemCount > count) {
            throw new Error('Invalid Serialized Data (SparseArray)');
          }
          const array: any[] = new Array(count).fill(null);
          for (let i = 0; i < itemCount; i++) {
            const nextPos = this.readEncodedInt32(bbf);
            if (nextPos >= count || nextPos < 0) {
              throw new Error(`Invalid Serialized Data (SparseArray pos=${nextPos})`);
            }
            array[nextPos] = this.decodeJsonObject(bbf);
          }
          return { [`SparseArray ${elementType}[]`]: array };
        }

        case Token.Null: {
          return null;
        }

        case Token.EmptyString: {
          return { String: '' };
        }

        case Token.ZeroInt32: {
          return { Int32: 0 };
        }

        case Token.True: {
          return { bool: true };
        }

        case Token.False: {
          return { bool: false };
        }

        default: {
          if (this.debug) {
            console.log(`Unknown token: 0x${token.toString(16).padStart(2, '0')}, remaining=${bbf.remaining()}`);
          }
          return { 'Unknown token': `0x${token.toString(16).padStart(2, '0')}` };
        }
      }
    } catch (err: any) {
      if (this.debug) {
        console.error('Decode error:', err.message);
      }
      return { Error: err.message };
    }
  }

  /**
   * Lit un entier encodé en 7-bit (LEB128 non signé)
   */
  private readEncodedInt32(bbf: ByteBuffer): number {
    let value = 0;
    let shift = 0;
    let readByte;
    do {
      readByte = bbf.get();
      value |= (readByte & 0x7f) << shift;
      shift += 7;
    } while ((readByte & 0x80) !== 0);
    return value;
  }

  /**
   * Lit une chaîne UTF-8 préfixée par sa longueur (7-bit encoded)
   */
  private readString(bbf: ByteBuffer): string {
    const length = this.readEncodedInt32(bbf);
    if (length < 0) {
      throw new Error('Invalid String Length');
    }
    if (length === 0) {
      return '';
    }
    const bytes = bbf.getBytes(length);
    return new TextDecoder('utf-8').decode(bytes);
  }

  /**
   * Lit un type (TypeRef, TypeRefAdd, TypeRefAddLocal)
   */
  private readType(bbf: ByteBuffer): { Type?: string; TypeRef?: string } {
    const token = bbf.get();
    switch (token) {
      case Token.TypeRef: {
        const typeID = this.readEncodedInt32(bbf);
        if (typeID < this.typeTable.length) {
          return { Type: this.typeTable[typeID] };
        } else if (typeID < KNOWN_TYPES.length) {
          return { Type: KNOWN_TYPES[typeID] };
        } else {
          return { Type: `TypeRef(${typeID})` };
        }
      }
      case Token.TypeRefAdd:
      case Token.TypeRefAddLocal: {
        const typeName = this.readString(bbf);
        this.typeTable.push(typeName);
        return { TypeRef: typeName };
      }
      default: {
        // Remettre le byte pour que l'appelant puisse le relire si besoin
        bbf.offset--;
        return { Type: 'Unknown' };
      }
    }
  }

  /**
   * Lit un identifiant de type sous forme de chaîne
   */
  private readTypeIdent(bbf: ByteBuffer): string {
    const ident = this.readType(bbf);
    if (ident.Type) return ident.Type;
    if (ident.TypeRef) return ident.TypeRef;
    return 'Unknown';
  }

  /**
   * Retourne le nom du type d'unité
   */
  private getUnitType(unitType: number): string {
    if (unitType > 0 && unitType <= UNIT_TYPES.length) {
      return UNIT_TYPES[unitType - 1];
    }
    return 'Unknown-UnitType';
  }
}

// ============================================================================
// Fonctions utilitaires
// ============================================================================

/**
 * Convertit une chaîne Base64 en Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Nettoyer la chaîne : supprimer espaces, retours à la ligne, et corriger les caractères URL-safe
  const cleaned = base64
    .replace(/[\s\r\n]+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  // Ajouter le padding si nécessaire
  const padded = cleaned + '==='.slice(0, (4 - (cleaned.length % 4)) % 4);
  
  const binaryString = atob(padded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convertit un Uint8Array en chaîne hexadécimale
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convertit un Uint8Array en Base64
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Décode un ViewState Base64 en Uint8Array
 */
export function decodeViewState(viewStateBase64: string): Uint8Array {
  if (typeof viewStateBase64 !== 'string') {
    throw new TypeError('viewStateBase64 doit être une chaîne.');
  }
  const normalized = viewStateBase64.replace(/\s+/g, '').replace(/ /g, '+');
  return base64ToUint8Array(normalized);
}

/**
 * Parse le header du ViewState
 */
export function parseHeader(buf: Uint8Array): { formatMarker: string; versionMarker: string } {
  if (buf.length < 2) {
    throw new Error('Buffer ViewState trop court (pas de header FF/01).');
  }
  return {
    formatMarker: buf[0].toString(16).padStart(2, '0').toUpperCase(),
    versionMarker: buf[1].toString(16).padStart(2, '0').toUpperCase(),
  };
}

/**
 * Parse un ViewState et retourne un objet structuré
 */
export function parseViewState(viewStateBase64: string, options: ViewStateParserOptions = {}): ViewStateParseResult {
  const parser = new ViewStateParser(options);
  return parser.parse(viewStateBase64);
}

/**
 * Parse un ViewState et retourne une représentation texte (JSON pretty)
 */
export function parseViewStateToText(viewStateBase64: string, options: ViewStateParserOptions = {}): string {
  const result = parseViewState(viewStateBase64, options);
  const lines: string[] = [];

  if (result.encrypted) {
    lines.push('ViewState is probably encrypted.');
    return lines.join('\n');
  }

  if (result.mac) {
    lines.push(`MAC: ${result.mac}`);
    lines.push(`Algorithm: ${result.macAlgorithm}`);
    lines.push(`Digest: ${result.digest}`);
    lines.push('');
  }

  lines.push(JSON.stringify(result.json, null, 2));

  return lines.join('\n');
}

/**
 * Parse un ViewState et retourne le JSON brut
 */
export function parseViewStateToJson(viewStateBase64: string, options: ViewStateParserOptions = {}): any {
  const result = parseViewState(viewStateBase64, options);
  return result.json;
}

/**
 * Extract ViewState from request body or query parameters
 */
export function extractViewState(body: string): string[] {
  const viewStates: string[] = [];

  // Match __VIEWSTATE parameter
  const viewStateRegex = /__VIEWSTATE=([^&\s]+)/gi;
  let match;

  while ((match = viewStateRegex.exec(body)) !== null) {
    viewStates.push(decodeURIComponent(match[1]));
  }

  return viewStates;
}

