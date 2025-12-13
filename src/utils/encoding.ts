/**
 * Encode a UTF-8 string to base64
 * btoa() doesn't handle UTF-8 properly, so we need this helper
 */
export function utf8ToBase64(str: string): string {
    // Convert UTF-8 string to base64
    // Use TextEncoder to properly handle UTF-8 characters
    const bytes = new TextEncoder().encode(str);
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
    return btoa(binString);
}

/**
 * Decode a base64 string to UTF-8
 */
export function base64ToUtf8(base64: string): string {
    const binString = atob(base64);
    const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!);
    return new TextDecoder().decode(bytes);
}
