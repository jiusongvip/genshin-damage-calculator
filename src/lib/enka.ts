// ============================================================================
// Enka.network UID import — pulls a player's showcased characters via the
// public (no-auth) Enka API and maps them to our calculator's panel inputs.
// ============================================================================

import type { ElementType } from './damage';

export interface ImportedPanel {
  characterName: string;
  characterId?: string;
  element?: ElementType;
  level: number;
  totalATK: number;
  baseATK: number;
  critRate: number;
  critDMG: number;
  em: number;
  dmgBonus: number;
  physicalBonus: number;
}

// Map Enka avatar IDs to our internal character ids — verified against the
// official EnkaNetwork characters.json store (authoritative avatarId source).
// Unmapped IDs still import their stat panel; only name/element fall back.
// NOTE: Lohen (6.6) and Alyosha (7.0) are not yet in the Enka snapshot —
// their IDs are added once the official store updates.
const ENKA_TO_INTERNAL: Record<number, { id: string; name: string; element: ElementType }> = {
  10000002: { id: 'ayaka', name: 'Kamisato Ayaka', element: 'cryo' },
  10000006: { id: 'lisa', name: 'Lisa', element: 'electro' },
  10000014: { id: 'barbara', name: 'Barbara', element: 'hydro' },
  10000015: { id: 'kaeya', name: 'Kaeya', element: 'cryo' },
  10000016: { id: 'diluc', name: 'Diluc', element: 'pyro' },
  10000020: { id: 'razor', name: 'Razor', element: 'electro' },
  10000021: { id: 'amber', name: 'Amber', element: 'pyro' },
  10000022: { id: 'venti', name: 'Venti', element: 'anemo' },
  10000023: { id: 'xiangling', name: 'Xiangling', element: 'pyro' },
  10000024: { id: 'beidou', name: 'Beidou', element: 'electro' },
  10000025: { id: 'xingqiu', name: 'Xingqiu', element: 'hydro' },
  10000026: { id: 'xiao', name: 'Xiao', element: 'anemo' },
  10000027: { id: 'ningguang', name: 'Ningguang', element: 'geo' },
  10000029: { id: 'klee', name: 'Klee', element: 'pyro' },
  10000030: { id: 'zhongli', name: 'Zhongli', element: 'geo' },
  10000031: { id: 'fischl', name: 'Fischl', element: 'electro' },
  10000032: { id: 'bennett', name: 'Bennett', element: 'pyro' },
  10000033: { id: 'tartaglia', name: 'Tartaglia', element: 'hydro' },
  10000034: { id: 'noelle', name: 'Noelle', element: 'geo' },
  10000035: { id: 'qiqi', name: 'Qiqi', element: 'cryo' },
  10000036: { id: 'chongyun', name: 'Chongyun', element: 'cryo' },
  10000037: { id: 'ganyu', name: 'Ganyu', element: 'cryo' },
  10000038: { id: 'albedo', name: 'Albedo', element: 'geo' },
  10000039: { id: 'diona', name: 'Diona', element: 'cryo' },
  10000041: { id: 'mona', name: 'Mona', element: 'hydro' },
  10000042: { id: 'keqing', name: 'Keqing', element: 'electro' },
  10000043: { id: 'sucrose', name: 'Sucrose', element: 'anemo' },
  10000044: { id: 'xinyan', name: 'Xinyan', element: 'pyro' },
  10000045: { id: 'rosaria', name: 'Rosaria', element: 'cryo' },
  10000046: { id: 'hu-tao', name: 'Hu Tao', element: 'pyro' },
  10000047: { id: 'kazuha', name: 'Kaedehara Kazuha', element: 'anemo' },
  10000048: { id: 'yanfei', name: 'Yanfei', element: 'pyro' },
  10000049: { id: 'yoimiya', name: 'Yoimiya', element: 'pyro' },
  10000050: { id: 'thoma', name: 'Thoma', element: 'pyro' },
  10000051: { id: 'eula', name: 'Eula', element: 'cryo' },
  10000052: { id: 'raiden-shogun', name: 'Raiden Shogun', element: 'electro' },
  10000053: { id: 'sayu', name: 'Sayu', element: 'anemo' },
  10000054: { id: 'kokomi', name: 'Sangonomiya Kokomi', element: 'hydro' },
  10000055: { id: 'gorou', name: 'Gorou', element: 'geo' },
  10000056: { id: 'kujou-sara', name: 'Kujou Sara', element: 'electro' },
  10000057: { id: 'itto', name: 'Arataki Itto', element: 'geo' },
  10000058: { id: 'yae-miko', name: 'Yae Miko', element: 'electro' },
  10000059: { id: 'heizou', name: 'Shikanoin Heizou', element: 'anemo' },
  10000060: { id: 'yelan', name: 'Yelan', element: 'hydro' },
  10000061: { id: 'kirara', name: 'Kirara', element: 'dendro' },
  10000062: { id: 'aloy', name: 'Aloy', element: 'cryo' },
  10000063: { id: 'shenhe', name: 'Shenhe', element: 'cryo' },
  10000064: { id: 'yun-jin', name: 'Yun Jin', element: 'geo' },
  10000066: { id: 'ayato', name: 'Kamisato Ayato', element: 'hydro' },
  10000067: { id: 'collei', name: 'Collei', element: 'dendro' },
  10000068: { id: 'dori', name: 'Dori', element: 'electro' },
  10000069: { id: 'tighnari', name: 'Tighnari', element: 'dendro' },
  10000070: { id: 'nilou', name: 'Nilou', element: 'hydro' },
  10000071: { id: 'cyno', name: 'Cyno', element: 'electro' },
  10000072: { id: 'candace', name: 'Candace', element: 'hydro' },
  10000073: { id: 'nahida', name: 'Nahida', element: 'dendro' },
  10000074: { id: 'layla', name: 'Layla', element: 'cryo' },
  10000075: { id: 'wanderer', name: 'Wanderer', element: 'anemo' },
  10000076: { id: 'faruzan', name: 'Faruzan', element: 'anemo' },
  10000077: { id: 'yaoyao', name: 'Yaoyao', element: 'dendro' },
  10000078: { id: 'alhaitham', name: 'Alhaitham', element: 'dendro' },
  10000079: { id: 'dehya', name: 'Dehya', element: 'pyro' },
  10000080: { id: 'mika', name: 'Mika', element: 'cryo' },
  10000081: { id: 'kaveh', name: 'Kaveh', element: 'dendro' },
  10000082: { id: 'baizhu', name: 'Baizhu', element: 'dendro' },
  10000083: { id: 'lynette', name: 'Lynette', element: 'anemo' },
  10000084: { id: 'lyney', name: 'Lyney', element: 'pyro' },
  10000085: { id: 'freminet', name: 'Freminet', element: 'cryo' },
  10000086: { id: 'wriothesley', name: 'Wriothesley', element: 'cryo' },
  10000087: { id: 'neuvillette', name: 'Neuvillette', element: 'hydro' },
  10000088: { id: 'charlotte', name: 'Charlotte', element: 'cryo' },
  10000089: { id: 'furina', name: 'Furina', element: 'hydro' },
  10000090: { id: 'chevreuse', name: 'Chevreuse', element: 'pyro' },
  10000091: { id: 'navia', name: 'Navia', element: 'geo' },
  10000092: { id: 'gaming', name: 'Gaming', element: 'pyro' },
  10000093: { id: 'xianyun', name: 'Xianyun', element: 'anemo' },
  10000095: { id: 'sigewinne', name: 'Sigewinne', element: 'hydro' },
  10000096: { id: 'arlecchino', name: 'Arlecchino', element: 'pyro' },
  10000097: { id: 'sethos', name: 'Sethos', element: 'electro' },
  10000098: { id: 'clorinde', name: 'Clorinde', element: 'electro' },
  10000099: { id: 'emilie', name: 'Emilie', element: 'dendro' },
  10000100: { id: 'kachina', name: 'Kachina', element: 'geo' },
  10000101: { id: 'kinich', name: 'Kinich', element: 'dendro' },
  10000102: { id: 'mualani', name: 'Mualani', element: 'hydro' },
  10000103: { id: 'xilonen', name: 'Xilonen', element: 'geo' },
  10000104: { id: 'chasca', name: 'Chasca', element: 'anemo' },
  10000105: { id: 'ororon', name: 'Ororon', element: 'electro' },
  10000106: { id: 'mavuika', name: 'Mavuika', element: 'pyro' },
  10000107: { id: 'citlali', name: 'Citlali', element: 'cryo' },
  10000108: { id: 'lan-yan', name: 'Lan Yan', element: 'anemo' },
  10000111: { id: 'varesa', name: 'Varesa', element: 'electro' },
  10000119: { id: 'lauma', name: 'Lauma', element: 'dendro' },
  10000120: { id: 'flins', name: 'Flins', element: 'electro' },
  10000121: { id: 'aino', name: 'Aino', element: 'hydro' },
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

interface EnkaAvatar {
  avatarId?: number;
  propMap?: Record<string, { type?: number; val?: string | number }>;
  fightPropMap?: Record<string, number | string>;
}

interface EnkaResponse {
  playerInfo?: { nickname?: string };
  avatarInfoList?: EnkaAvatar[];
}

export async function fetchEnkaPanel(uid: string): Promise<ImportedPanel | null> {
  const clean = uid.trim();
  if (!/^\d{7,10}$/.test(clean)) return null;

  const res = await fetch(`https://enka.network/api/uid/${clean}`, {
    headers: { 'User-Agent': 'genshin-damage-calculator/1.0' },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as EnkaResponse;
  const avatars = data.avatarInfoList ?? [];
  if (avatars.length === 0) return null;

  const avatar = avatars[0];
  const fp = avatar.fightPropMap ?? {};
  const mapped = avatar.avatarId != null ? ENKA_TO_INTERNAL[avatar.avatarId] : undefined;

  // Enka fightPropMap keys (merged panel):
  // 4 = base ATK, 5 = total ATK, 20 = CRIT Rate, 22 = CRIT DMG,
  // 23 = Elemental Mastery, 28 = elemental DMG bonus, 29 = physical DMG bonus.
  const level = (() => {
    const levelProp = avatar.propMap?.['4001'];
    const lv = levelProp?.val != null ? num(levelProp.val) : 90;
    return lv >= 1 && lv <= 90 ? Math.round(lv) : 90;
  })();

  return {
    characterName: mapped?.name ?? `Unknown character (${avatar.avatarId ?? '?'})`,
    characterId: mapped?.id,
    element: mapped?.element,
    level,
    totalATK: num(fp[5]),
    baseATK: num(fp[4]),
    critRate: num(fp[20]),
    critDMG: num(fp[22]),
    em: num(fp[23]),
    dmgBonus: num(fp[28]),
    physicalBonus: num(fp[29]),
  };
}
