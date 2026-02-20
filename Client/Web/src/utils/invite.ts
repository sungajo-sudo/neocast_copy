/**
 * 세션 초대 링크 인코딩/디코딩 유틸리티
 * 세션 코드와 비밀번호를 안전하게 URL에 포함
 */

export interface InviteData {
  code: string;
  password?: string; // Legacy: plain password (deprecated)
  inviteToken?: string; // New: server-generated token for password-free join
}

/**
 * 세션 코드와 비밀번호를 인코딩
 * XOR + Base64 URL-safe 인코딩
 */
export function encodeInvite(data: InviteData): string {
  const payload = JSON.stringify(data);

  // 간단한 XOR 난독화 (키: 'penstream')
  const key = 'penstream';
  const xored = payload.split('').map((char, i) => {
    const keyChar = key.charCodeAt(i % key.length);
    return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
  }).join('');

  // Base64 URL-safe 인코딩
  const base64 = btoa(xored);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 인코딩된 초대 데이터를 디코딩
 */
export function decodeInvite(encoded: string): InviteData | null {
  try {
    // Base64 URL-safe → 표준 Base64
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // 패딩 복원
    while (base64.length % 4) {
      base64 += '=';
    }

    const xored = atob(base64);

    // XOR 복호화
    const key = 'penstream';
    const payload = xored.split('').map((char, i) => {
      const keyChar = key.charCodeAt(i % key.length);
      return String.fromCharCode(char.charCodeAt(0) ^ keyChar);
    }).join('');

    return JSON.parse(payload) as InviteData;
  } catch {
    return null;
  }
}

/**
 * 초대 링크 생성
 */
export function createInviteLink(baseUrl: string, data: InviteData): string {
  const encoded = encodeInvite(data);
  return `${baseUrl}/join/${encoded}`;
}

/**
 * URL 경로에서 초대 데이터 파싱
 * /join/ENCODED_DATA 또는 /join/ABC123 (레거시 6자리 코드)
 */
export function parseInviteFromPath(pathname: string): InviteData | null {
  const match = pathname.match(/\/join\/(.+)/);
  if (!match) return null;

  const param = match[1];

  // 6자리 영숫자만 있으면 레거시 세션 코드
  if (/^[A-Z0-9]{6}$/i.test(param)) {
    return { code: param.toUpperCase() };
  }

  // 그 외에는 인코딩된 데이터로 시도
  return decodeInvite(param);
}
