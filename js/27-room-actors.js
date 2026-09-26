/* ===== Your character and the animals that walk around the room =====
   Everything that moves is drawn once as SVG with named parts (legs, arms, tail…); a small loop moves the
   parts and slides the whole figure from tile to tile, keeping the right depth among the furniture. */

/* ---------- the character ---------- */
const AV_SKINS = ['#fde3cf', '#f6d0ae', '#e9b98f', '#d7a077', '#b77a51', '#8d5a3b', '#6a4129', '#f3d9c4'];
const AV_HAIR = [['short', 'Short'], ['side', 'Side part'], ['bob', 'Bob'], ['long', 'Long'], ['pony', 'Ponytail'], ['bun', 'Bun'], ['curly', 'Curly'], ['afro', 'Afro'], ['spiky', 'Spiky'], ['buzz', 'Buzz cut'], ['braids', 'Braids'], ['bald', 'None']];
const AV_HAIR_C = ['#1f1b18', '#3b2a20', '#6b4a2e', '#9a6232', '#d49a4e', '#ead08c', '#b54a2c', '#8a8f98', '#f1efe9', '#7d5aa6', '#3f86c7', '#e57aa6'];
const AV_TOPS = [['tee', 'T-shirt'], ['hoodie', 'Hoodie'], ['sweater', 'Sweater'], ['shirt', 'Shirt & tie'], ['blazer', 'Blazer'], ['dress', 'Dress'], ['tank', 'Tank top'], ['jersey', 'Jersey']];
const AV_CLOTH_C = ['#3f6ea8', '#2f3440', '#b5483f', '#4f8a5b', '#d4a23a', '#7d5aa6', '#e87aa8', '#2f7f86', '#eeeae2', '#c46a41', '#8a9bb3', '#1f2a4a', '#6b8e23', '#f2c14e'];
const AV_BOTTOMS = [['pants', 'Trousers'], ['jeans', 'Jeans'], ['shorts', 'Shorts'], ['skirt', 'Skirt']];
const AV_FACE = [['none', 'None'], ['stubble', 'Stubble'], ['mustache', 'Moustache'], ['beard', 'Beard']];
const AV_GLASSES = [['none', 'None'], ['round', 'Round'], ['square', 'Square'], ['shades', 'Sunglasses']];
/* the last ones are earned with achievements */
const AV_HATS = [['none', 'None'], ['beanie', 'Beanie'], ['cap', 'Cap'], ['bucket', 'Bucket hat'], ['bow', 'Bow'], ['phones', 'Headphones', 'long_2h'], ['laurel', 'Laurel wreath', 'marathon'], ['wizard', 'Wizard hat', 'book_25'], ['lotus', 'Lotus crown', 'med_100'], ['grad', 'Graduation cap', 'hours_1000'], ['crown', 'Crown', 'streak_100']];
const AVATAR_DEFAULT = { skin: 1, hair: 'short', hairC: '#3b2a20', top: 'hoodie', topC: '#3f6ea8', bottom: 'pants', bottomC: '#2f3440', shoes: '#eeeae2', face: 'none', glasses: 'none', hat: 'none', name: '' };
const avatarOf = () => ({ ...AVATAR_DEFAULT, ...(state.room.avatar || {}) });
const hatUnlocked = (id) => { const h2 = AV_HATS.find((x) => x[0] === id); return !!h2 && (!h2[2] || !!(state.settings.achievements || {})[h2[2]]); };

/* The figure is drawn facing the lower right (front) or the upper right (back); the left is a mirror.
   Feet at (0,0); the head is about 44 units up. */
function avatarParts(av, back) {
  const skin = AV_SKINS[av.skin] || AV_SKINS[1], skinD = tone(skin, -0.16), hc = av.hairC, hcD = tone(hc, -0.25), top = av.topC, topD = tone(top, -0.22), topL = tone(top, 0.12);
  const bot = av.bottomC, botD = tone(bot, -0.25), shoe = av.shoes, st = (c) => ` stroke="${tone(c, -0.45)}" stroke-width=".7" stroke-linejoin="round"`;
  const long = av.top !== 'tee' && av.top !== 'tank' && av.top !== 'jersey' && av.top !== 'dress';
  const legSkin = av.bottom === 'shorts' || av.bottom === 'skirt' || av.top === 'dress';
  const leg = (x, dark) => {
    const c = dark ? tone(bot, -0.18) : bot; const sk = dark ? skinD : skin;
    const upper = legSkin ? (av.bottom === 'shorts' ? `<rect x="${x - 2.3}" y="-13.5" width="4.6" height="6" rx="1.2" fill="${c}"${st(c)}/>` : '') : `<rect x="${x - 2.2}" y="-13.5" width="4.4" height="12" rx="1.6" fill="${c}"${st(c)}/>`;
    const skinLeg = legSkin ? `<rect x="${x - 1.7}" y="-10" width="3.4" height="8.6" rx="1.4" fill="${sk}"${st(sk)}/>` : '';
    const jeans = av.bottom === 'jeans' && !legSkin ? `<path d="M${x + 0.8},-12 V-3" stroke="${tone(c, 0.25)}" stroke-width=".5" opacity=".8"/>` : '';
    const sh = dark ? tone(shoe, -0.2) : shoe;
    return `${skinLeg}${upper}${jeans}<ellipse cx="${x + (back ? 0.6 : 1.3)}" cy="-1.3" rx="3.1" ry="1.8" fill="${sh}"${st(sh)}/>`;
  };
  const arm = (x, dark) => {
    const sleeve = dark ? topD : top, sk = dark ? skinD : skin;
    const len = long ? 10.5 : av.top === 'tank' ? 0 : 4.2;
    return `<rect x="${x - 1.9}" y="-26" width="3.8" height="11" rx="1.8" fill="${sk}"${st(sk)}/>${len ? `<rect x="${x - 2.1}" y="-26.2" width="4.2" height="${len}" rx="1.8" fill="${sleeve}"${st(sleeve)}/>` : ''}${av.top === 'jersey' ? `<rect x="${x - 2.1}" y="-23.4" width="4.2" height="1" fill="#fff" opacity=".8"/>` : ''}<circle cx="${x}" cy="-14.6" r="1.9" fill="${sk}"${st(sk)}/>`;
  };
  // torso
  let torso = `<path d="M-6.4,-24.6 Q-6.6,-27 -4,-27.2 L4.6,-27.2 Q7,-27 6.8,-24.6 L6.4,-13 Q0,-11.8 -6,-13 Z" fill="${top}"${st(top)}/>`;
  torso += `<path d="M4.2,-26.8 Q6.8,-26.6 6.6,-24.4 L6.3,-13.2 Q5,-12.8 3.8,-12.7 Z" fill="${topD}" opacity=".55"/>`; // the side in shade
  if (av.top === 'hoodie') torso += back ? `<path d="M-4.5,-27 Q0,-21 4.8,-27" fill="${topD}"${st(top)}/>` : `<path d="M-5.2,-27.2 Q-7.5,-30 -3.5,-30.5" fill="${topD}"${st(top)}/><rect x="-2.6" y="-19.5" width="7.4" height="4.4" rx="1.4" fill="${topD}" opacity=".7"/><path d="M1.2,-26.5 v4 M3.3,-26.5 v3.5" stroke="${topL}" stroke-width=".7"/>`;
  if (av.top === 'sweater') torso += `<rect x="-6.1" y="-15" width="12.4" height="2.2" rx="1" fill="${topD}"/>${back ? '' : `<path d="M-1.8,-27.2 Q1.2,-24.6 4.2,-27.2" fill="none" stroke="${topL}" stroke-width="1.4"/>`}`;
  if (av.top === 'shirt' && !back) { const tie = hexToHsl(top).l > 60 ? '#b5483f' : '#e8b93c'; torso += `<path d="M-1.2,-27.2 L1.4,-24.5 L3.8,-27.2" fill="#fff"${st('#ffffff')}/><path d="M1.4,-24.8 l-1.1,1.2 l0.6,7 l0.5,1.2 l0.5,-1.2 l0.6,-7 Z" fill="${tie}"/>`; }
  if (av.top === 'blazer' && !back) torso += `<path d="M-0.8,-27.2 L1.4,-18.5 L3.6,-27.2 Z" fill="#f4f1ea"/><path d="M-1.2,-27.2 L1.4,-18.5 L-0.5,-22 Z M3.9,-27.2 L1.4,-18.5 L3.4,-22 Z" fill="${topD}"/><circle cx="1.4" cy="-16.8" r=".6" fill="${topL}"/><circle cx="1.4" cy="-14.8" r=".6" fill="${topL}"/>`;
  if (av.top === 'tank') torso = `<path d="M-5.6,-24 Q-5.6,-26.4 -3.4,-26.6 L-2,-26.6 Q1.4,-23.6 3.2,-26.6 L4.6,-26.6 Q6.6,-26.4 6.4,-24 L6.2,-13 Q0,-11.8 -5.4,-13 Z" fill="${top}"${st(top)}/>`;
  if (av.top === 'jersey') torso += back ? `<text x="0.4" y="-16.5" font-size="8" text-anchor="middle" fill="#fff" font-family="system-ui" font-weight="800">7</text>` : `<path d="M-1.4,-27.2 Q1.2,-25 3.8,-27.2" fill="none" stroke="#fff" stroke-width="1"/><text x="1.8" y="-17" font-size="6" text-anchor="middle" fill="#fff" font-family="system-ui" font-weight="800">7</text>`;
  if (av.top === 'dress') torso += `<path d="M-6,-14.5 L-8.4,-5.5 Q0.4,-3.6 9,-5.5 L6.4,-14.5 Z" fill="${top}"${st(top)}/><path d="M-7.6,-7 Q0.4,-5.2 8.4,-7" stroke="${topL}" stroke-width=".8" fill="none"/>`;
  if (av.bottom === 'skirt' && av.top !== 'dress') torso += `<path d="M-6.2,-14.2 L-7.8,-7.6 Q0.4,-6 8.2,-7.6 L6.4,-14.2 Z" fill="${bot}"${st(bot)}/>`;
  else if (av.top !== 'dress') torso += `<rect x="-6" y="-14.4" width="12.4" height="1.6" rx=".6" fill="${botD}"/>`;
  // head
  const hx = 1, hy = -36, r = 8.6;
  const backHair = { long: `<path d="M-8.4,-37 Q-9.8,-26 -6.6,-19.5 L7.6,-19.5 Q10.6,-26 9.8,-36 Z" fill="${hcD}"${st(hc)}/>`, bob: `<path d="M-8.6,-38 Q-9.6,-30 -7.6,-27.2 L-2,-27.2 L-2,-38 Z" fill="${hcD}"${st(hc)}/>`, afro: `<circle cx="-0.4" cy="-38.2" r="12.4" fill="${hc}"${st(hc)}/>`, braids: `<path d="M-7.6,-33 q-1.6,4 0,8 q-1.6,4 0,8" stroke="${hcD}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`, curly: Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.55 + i * 0.16); return `<circle cx="${f1(hx + Math.cos(a) * 8.6)}" cy="${f1(hy - Math.sin(a) * 8.6 + 1)}" r="3.4" fill="${hc}"${st(hc)}/>`; }).join('') };
  let head = back ? '' : (backHair[av.hair] || '');
  if (av.hair === 'pony' && !back) head += `<g data-p="tail" data-px="-6.5" data-py="-39"><path d="M-6.5,-39.5 C-12,-40 -13.4,-33 -11.6,-27 C-10.6,-24 -8.6,-25.6 -9.2,-29 C-9.8,-33 -8.6,-36.5 -6,-37 Z" fill="${hc}"${st(hc)}/></g>`;
  if (av.hair === 'bun') head += `<circle cx="-3.4" cy="-45.4" r="4" fill="${hc}"${st(hc)}/>`;
  head += `<rect x="-1.4" y="-29.6" width="4.4" height="3.4" fill="${skinD}"/>`; // neck
  head += `<circle cx="${hx}" cy="${hy}" r="${r}" fill="${skin}"${st(skin)}/>`;
  if (back) {
    // seen from behind: mostly hair (unless there is none)
    const cover = av.hair === 'bald' ? '' : av.hair === 'buzz' ? `<circle cx="${hx}" cy="${hy - 0.4}" r="${r - 0.3}" fill="${hc}" opacity=".55"/>` : `<path d="M${hx - r - 0.4},${hy + 1} A${r + 0.4},${r + 0.4} 0 1 1 ${hx + r + 0.4},${hy + 1} Q${hx + r},${hy + 6.5} ${hx + 3},${hy + 7.8} L${hx - 3},${hy + 7.8} Q${hx - r},${hy + 6.5} ${hx - r - 0.4},${hy + 1} Z" fill="${hc}"${st(hc)}/>`;
    head += `<ellipse cx="${hx + r - 0.4}" cy="${hy + 0.6}" rx="1.6" ry="2.3" fill="${skinD}"/>` + cover;
    if (av.hair === 'long') head += `<path d="M-8,-35 Q-9,-25 -6.4,-19.5 L8.4,-19.5 Q11,-25 10,-35 Z" fill="${hc}"${st(hc)}/>`;
    if (av.hair === 'afro') head += `<circle cx="${hx}" cy="${hy - 2}" r="12.2" fill="${hc}"${st(hc)}/>`;
    if (av.hair === 'curly') head += Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.05 + i * 0.113); return `<circle cx="${f1(hx + Math.cos(a) * 8)}" cy="${f1(hy - Math.sin(a) * 8 + 1)}" r="3.3" fill="${hc}"${st(hc)}/>`; }).join('');
    if (av.hair === 'pony') head += `<g data-p="tail" data-px="1" data-py="-38"><path d="M-1,-38 C-3,-32 -2,-26 1,-23 C4,-26 5,-32 3,-38 Z" fill="${hc}"${st(hc)}/></g>`;
    if (av.hair === 'bun') head += `<circle cx="${hx}" cy="-44.6" r="4.2" fill="${hc}"${st(hc)}/>`;
    if (av.hair === 'braids') head += `<path d="M-3,-31 q-1.4,4 0,8 q-1.4,4 0,8 M5,-31 q1.4,4 0,8 q1.4,4 0,8" stroke="${hc}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
  } else {
    head += `<ellipse cx="-5.2" cy="-35.4" rx="1.8" ry="2.5" fill="${skinD}"/>`; // ear
    head += `<ellipse cx="7.9" cy="-32.6" rx="1.7" ry="1" fill="#f08a8a" opacity=".38"/>`;
    head += `<g data-p="eyes" data-px="5" data-py="-36.4"><ellipse cx="3.3" cy="-36.4" rx="1.05" ry="1.5" fill="#2a2320"/><ellipse cx="7.1" cy="-36.5" rx="1" ry="1.45" fill="#2a2320"/><circle cx="3.6" cy="-36.9" r=".38" fill="#fff"/><circle cx="7.4" cy="-37" r=".36" fill="#fff"/></g>`;
    head += `<path d="M2.2,-39.4 l2.2,-.5 M6.3,-39.6 l1.8,-.1" stroke="${hcD}" stroke-width=".8" stroke-linecap="round"/>`;
    head += `<path d="M4.4,-31.9 q1.3,1 2.6,-.1" stroke="#8a4a3a" stroke-width=".75" fill="none" stroke-linecap="round"/>`;
    if (av.face === 'stubble') head += `<path d="M-3.6,-31.5 Q1,-26.6 8.6,-31 Q8.2,-28.4 4,-27.6 Q-1,-27.4 -3.6,-31.5 Z" fill="${hc}" opacity=".3"/>`;
    if (av.face === 'mustache') head += `<path d="M3.6,-32.9 q1.6,-1.2 3,-.1 q1.4,-1 2.4,.4 q-1.5,.7 -2.6,.1 q-1.3,.8 -2.8,-.4 Z" fill="${hc}"/>`;
    if (av.face === 'beard') head += `<path d="M-4.4,-34 Q-4,-26.4 2.6,-25.6 Q8.4,-26 9.4,-32.4 Q7.6,-30 5.6,-30.4 Q4,-31.2 2.6,-30.4 Q-0.6,-30 -2,-33.4 Z" fill="${hc}"${st(hc)}/><path d="M3.8,-33 q1.6,-1 3,0 q1.3,-.8 2.2,.3" stroke="${hc}" stroke-width="1.1" fill="none"/>`;
    if (av.glasses === 'round') head += `<circle cx="3.3" cy="-36.3" r="2.3" fill="#fff" fill-opacity=".15" stroke="#2a2320" stroke-width=".8"/><circle cx="7.3" cy="-36.4" r="2.1" fill="#fff" fill-opacity=".15" stroke="#2a2320" stroke-width=".8"/><path d="M5.6,-36.6 h-.1 M1,-36.4 l-3.4,-.9" stroke="#2a2320" stroke-width=".8"/>`;
    if (av.glasses === 'square') head += `<rect x="1" y="-38.1" width="4.4" height="3.5" rx=".8" fill="#fff" fill-opacity=".15" stroke="#2a2320" stroke-width=".85"/><rect x="5.8" y="-38.2" width="3.6" height="3.4" rx=".8" fill="#fff" fill-opacity=".15" stroke="#2a2320" stroke-width=".85"/><path d="M1,-36.6 l-3.4,-.8" stroke="#2a2320" stroke-width=".8"/>`;
    if (av.glasses === 'shades') head += `<path d="M0.8,-38.2 h4.8 v2.2 q0,1.8 -2.4,1.8 q-2.4,0 -2.4,-1.8 Z M5.9,-38.3 h3.8 v2.1 q0,1.7 -1.9,1.7 q-1.9,0 -1.9,-1.7 Z" fill="#1c1c22"/><path d="M1,-37.8 l-3.4,-.7" stroke="#1c1c22" stroke-width=".9"/>`;
    const fr = {
      short: `<path d="M-7.9,-33.2 C-9.4,-43 -2.6,-46.6 3.4,-45.6 C8.8,-44.8 11.2,-40.8 9.9,-37.4 C7.6,-39.9 4.4,-40.6 1.2,-39.6 C-1.2,-38.8 -3.4,-37 -4.4,-33.6 C-5.6,-31 -7.2,-30.8 -7.9,-33.2 Z" fill="${hc}"${st(hc)}/>`,
      side: `<path d="M-8,-32.5 C-9.8,-42.5 -3.4,-46.8 2.6,-46 C9,-45.2 11.4,-40.6 9.8,-36.6 C8,-38.4 6.2,-39.8 3.8,-40.4 C4.6,-39 4.4,-37.8 3.4,-37 C1.6,-39.6 -1.8,-39 -3.8,-36.8 C-5.4,-35 -5.8,-31.6 -8,-32.5 Z" fill="${hc}"${st(hc)}/>`,
      bob: `<path d="M-8.6,-30.2 C-11,-42 -3.4,-47 3,-46 C9.6,-45 11.8,-40 10.2,-36 C8,-38.8 5.4,-39.6 2.6,-39.3 C0,-39 -2.4,-37.4 -3.2,-33.8 L-3.4,-27.8 C-5.6,-27.4 -7.6,-28.2 -8.6,-30.2 Z" fill="${hc}"${st(hc)}/>`,
      long: `<path d="M-8.8,-28 C-11,-42 -3.4,-47 3,-46 C9.6,-45 11.8,-40 10.2,-36 C8,-38.8 5.4,-39.6 2.6,-39.3 C0,-39 -2.6,-37 -3.2,-33 L-3.6,-24.6 C-6,-24.4 -8,-25.8 -8.8,-28 Z" fill="${hc}"${st(hc)}/>`,
      pony: `<path d="M-7.9,-33.8 C-9.2,-43 -2.6,-46.6 3.4,-45.6 C8.8,-44.8 11.2,-40.8 9.9,-37.4 C7.4,-39.6 4.6,-40.2 1.8,-39.8 C-1,-39.4 -3.4,-37.8 -4.6,-34.6 C-5.8,-32 -7.4,-31.6 -7.9,-33.8 Z" fill="${hc}"${st(hc)}/>`,
      bun: `<path d="M-7.9,-33.8 C-9.2,-43 -2.6,-46.6 3.4,-45.6 C8.8,-44.8 11.2,-40.8 9.9,-37.4 C7.4,-39.6 4.6,-40.2 1.8,-39.8 C-1,-39.4 -3.4,-37.8 -4.6,-34.6 C-5.8,-32 -7.4,-31.6 -7.9,-33.8 Z" fill="${hc}"${st(hc)}/>`,
      braids: `<path d="M-7.9,-33.8 C-9.2,-43 -2.6,-46.6 3.4,-45.6 C8.8,-44.8 11.2,-40.8 9.9,-37.4 C7.6,-40.4 3.6,-41.2 1.2,-40.6 C-1.4,-40 -3.6,-37.8 -4.6,-34.6 C-5.8,-32 -7.4,-31.6 -7.9,-33.8 Z" fill="${hc}"${st(hc)}/>`,
      curly: `<path d="M-8,-33 C-9.6,-43 -2.6,-46.8 3.4,-45.8 C9,-44.8 11.4,-40.8 10,-37 C7,-39.6 3.6,-40.4 0.4,-39.2 C-2,-38.2 -3.8,-36 -4.6,-33.4 C-5.8,-31 -7.4,-30.8 -8,-33 Z" fill="${hc}"${st(hc)}/>` + [[-4, -43], [0.6, -45.4], [5.4, -44.4], [8.8, -40.6], [-7.4, -38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${hc}"${st(hc)}/>`).join(''),
      afro: [[-6, -42], [-1, -46], [4.6, -45.6], [9, -41.4], [10.4, -37.4], [-8.6, -36.4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.1" fill="${hc}"${st(hc)}/>`).join('') + `<path d="M-6,-38 C-2,-42 5,-43 10,-38.6 L10,-40 C5,-45 -3,-45 -7,-40 Z" fill="${hc}"/>`,
      spiky: `<path d="M-8,-33 L-9.6,-40 L-6.4,-39.6 L-7,-45.6 L-2.6,-42.4 L-1.2,-48.2 L2.2,-43.6 L5.2,-47.6 L6.4,-42.6 L10.8,-44 L9.6,-39.6 L11.6,-38 C8,-39.6 4.6,-40.2 1.4,-39.4 C-1.2,-38.6 -3.4,-36.8 -4.4,-33.6 C-5.6,-31 -7.2,-30.8 -8,-33 Z" fill="${hc}"${st(hc)}/>`,
      buzz: `<path d="M-7.6,-35 C-8.6,-42 -3,-45.4 2.4,-45 C7.6,-44.6 10,-41.6 9.6,-39.4 C6.8,-41 2.6,-41.4 -0.8,-40.4 C-3.6,-39.4 -5.8,-37.6 -7.6,-35 Z" fill="${hc}" opacity=".75"/>`,
      bald: '',
    };
    head += fr[av.hair] ?? fr.short;
  }
  head += hatSvg(av.hat, back);
  return { leg, arm, torso, head };
}
function hatSvg(hat, back) {
  const st = (c) => ` stroke="${tone(c, -0.45)}" stroke-width=".7"`;
  switch (hat) {
    case 'beanie': return `<path d="M-8.4,-38 C-8.6,-47 -2,-49.6 2,-49.4 C7,-49.2 11,-46 10.4,-38.4 Z" fill="#c0463c"${st('#c0463c')}/><rect x="-8.9" y="-39.8" width="19.8" height="3.4" rx="1.6" fill="#d9695e"${st('#c0463c')}/><circle cx="1" cy="-49.8" r="2.2" fill="#f3ead2"/>`;
    case 'cap': return back ? `<path d="M-8.2,-38.6 C-8.2,-47 -2,-48.8 1.6,-48.6 C6.6,-48.4 10.4,-45.6 10,-38.6 Z" fill="#2f5d9a"${st('#2f5d9a')}/><rect x="-1" y="-40" width="4" height="1.6" fill="#f3ead2"/>` : `<path d="M-8.2,-38.6 C-8.2,-47 -2,-48.8 1.6,-48.6 C6.6,-48.4 10.4,-45.6 10,-38.6 Z" fill="#2f5d9a"${st('#2f5d9a')}/><path d="M6,-39.8 Q13,-40.8 16,-38.6 Q12,-37.2 6.4,-38 Z" fill="#244a7c"${st('#2f5d9a')}/><circle cx="1.4" cy="-48.4" r="1" fill="#f3ead2"/>`;
    case 'bucket': return `<path d="M-6.8,-40 C-6.8,-47.6 -1,-48.6 1.4,-48.6 C4,-48.6 9.2,-47.6 9.2,-40 Z" fill="#c9a86a"${st('#c9a86a')}/><path d="M-11,-38.4 Q1,-43 13.4,-38.4 Q1,-35.8 -11,-38.4 Z" fill="#b8955a"${st('#c9a86a')}/>`;
    case 'bow': return `<g transform="translate(${back ? 1 : -4},-45)"><path d="M0,0 L-5,-3.6 L-5,3.6 Z M0,0 L5,-3.6 L5,3.6 Z" fill="#e0508a"${st('#e0508a')}/><circle r="1.7" fill="#f070a0"/></g>`;
    case 'crown': return `<path d="M-6.6,-43 L-7.6,-51.6 L-3.2,-47.4 L1,-53.4 L5.2,-47.4 L9.6,-51.6 L8.6,-43 Z" fill="url(#rm-gold)" stroke="#a87b16" stroke-width=".8"/><circle cx="1" cy="-46.4" r="1.3" fill="#c0463c"/><circle cx="-4.2" cy="-45.4" r=".9" fill="#3f86c7"/><circle cx="6.2" cy="-45.4" r=".9" fill="#4f8a5b"/>`;
    case 'wizard': return `<path d="M-9.6,-40.6 Q1,-44.6 12,-40.6 Q1,-37.4 -9.6,-40.6 Z" fill="#3b2d6e"${st('#3b2d6e')}/><path d="M-5.6,-41.4 L2.8,-62 Q5,-58 7.2,-53.4 L10.2,-50 L7.6,-49.4 L8,-41.4 Z" fill="#4a3a8a"${st('#4a3a8a')}/><path d="M-1,-49 l1,-2 l1,2 l2,.2 l-1.6,1.3 l.6,2 l-2,-1.1 l-2,1.1 l.6,-2 l-1.6,-1.3 Z" fill="#ffe08a"/>`;
    case 'grad': return `<path d="M-9.8,-44.4 L1.2,-49.2 L12.2,-44.4 L1.2,-39.6 Z" fill="#1f1f24"${st('#1f1f24')}/><path d="M-5,-42.4 L-5,-38.4 Q1.2,-35.4 7.4,-38.4 L7.4,-42.4 L1.2,-39.6 Z" fill="#2a2a30"/><path d="M1.2,-44.4 L9.4,-43 L9.4,-37.4" stroke="#e8b93c" stroke-width=".9" fill="none"/><circle cx="9.4" cy="-37" r="1.1" fill="#e8b93c"/>`;
    case 'laurel': return Array.from({ length: 6 }, (_, i) => `<ellipse cx="${-7 + i * 1.3}" cy="${-40 - i * 1.4}" rx="2.4" ry="1.1" transform="rotate(${-50 + i * 8} ${-7 + i * 1.3} ${-40 - i * 1.4})" fill="#8bb84a" stroke="#4f6e2a" stroke-width=".4"/><ellipse cx="${9 - i * 1.3}" cy="${-40 - i * 1.4}" rx="2.4" ry="1.1" transform="rotate(${50 - i * 8} ${9 - i * 1.3} ${-40 - i * 1.4})" fill="#8bb84a" stroke="#4f6e2a" stroke-width=".4"/>`).join('');
    case 'phones': return back ? `<path d="M-8.6,-36 C-9,-47 11,-47 10.6,-36" stroke="#2b2b30" stroke-width="1.8" fill="none"/><rect x="-10.4" y="-38.6" width="3.6" height="6" rx="1.5" fill="#e0403a"/><rect x="8.8" y="-38.6" width="3.6" height="6" rx="1.5" fill="#e0403a"/>` : `<path d="M-6.4,-36 C-7,-48 10,-49 10.4,-40" stroke="#2b2b30" stroke-width="1.8" fill="none"/><rect x="-8" y="-38.8" width="4.6" height="6.6" rx="2" fill="#e0403a" stroke="#8e2622" stroke-width=".6"/>`;
    case 'lotus': return [[-6, -44.6, -40], [-2.6, -47, -15], [1, -48, 0], [4.6, -47, 15], [8, -44.6, 40]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="1.9" ry="4" transform="rotate(${a} ${x} ${y})" fill="#f7a8c8" stroke="#c8588a" stroke-width=".5"/>`).join('') + '<rect x="-7" y="-43.4" width="16" height="1.6" rx=".8" fill="#6cbf63"/>';
    default: return '';
  }
}
/* one figure (front and back poses; named parts for the walk) */
function avatarSvg(av, { still = false } = {}) {
  const pose = (back) => {
    const P2 = avatarParts(av, back);
    return `<g data-pose="${back ? 'back' : 'front'}"${back ? ' display="none"' : ''}>`
      + `<g data-p="legB" data-px="-2.4" data-py="-13">${P2.leg(-2.4, true)}</g><g data-p="armB" data-px="-5.2" data-py="-25">${P2.arm(-5.2, true)}</g>`
      + `<g data-p="legF" data-px="2.4" data-py="-13">${P2.leg(2.4, false)}</g>`
      + P2.torso + `<g data-p="head" data-px="1" data-py="-28">${P2.head}</g>`
      + `<g data-p="armF" data-px="5.4" data-py="-25">${P2.arm(5.4, false)}</g></g>`;
  };
  return `<ellipse cx="0.6" cy="-0.4" rx="8.6" ry="3.4" fill="#000" opacity=".2"/><g data-p="flip"><g data-p="bob">${pose(false)}${still ? '' : pose(true)}</g></g>`;
}

/* ---------- animals, drawn from the side (they walk along the room's diagonals) ---------- */
function quadSvg(sp) {
  const c = sp.c, c2 = sp.c2 || tone(c, 0.35), cd = tone(c, -0.28), ol = tone(c, -0.55), st = ` stroke="${ol}" stroke-width=".7" stroke-linejoin="round"`;
  const s = sp.size || 1, L = sp.legs || 1, B = sp.body || 1, dog = sp.kind !== 'cat';
  const bw = (dog ? 10.2 : 9.8) * B, bh = dog ? 6 : 5.3, legH = (dog ? 8.2 : 7) * L, by = -(legH + bh * 0.55);
  const hr = sp.head || (dog ? 5.9 : 5.1); const hx = bw + (dog ? 1.2 : 0.6), hy = by - (dog ? 6 : 4.6);
  // a leg: thigh to paw, slightly tapered; far legs are darker
  const leg = (x, far, back) => {
    const col = far ? cd : sp.socks ? c2 : c; const top = by + 1.4; const w = back ? 3.2 : 2.7;
    const paw = sp.socks || sp.paws ? (far ? tone(c2, -0.25) : c2) : col;
    return `<g data-p="${far ? (back ? 'bl' : 'fl') : (back ? 'br' : 'fr')}" data-px="${f1(x)}" data-py="${f1(top)}"><path d="M${f1(x - w / 2)},${f1(top)} L${f1(x + w / 2)},${f1(top)} L${f1(x + w * 0.36)},-1.6 L${f1(x - w * 0.36)},-1.6 Z" fill="${col}"${st}/><ellipse cx="${f1(x + 0.5)}" cy="-1.1" rx="${f1(w * 0.62)}" ry="1.15" fill="${paw}"${st}/></g>`;
  };
  const tails = {
    cat: `M${f1(-bw + 1.2)},${f1(by - 1.2)} C${f1(-bw - 5)},${f1(by - 2)} ${f1(-bw - 7.5)},${f1(by - 9)} ${f1(-bw - 5)},${f1(by - 14)}`,
    wag: `M${f1(-bw + 1.2)},${f1(by - 2.4)} C${f1(-bw - 2.6)},${f1(by - 5)} ${f1(-bw - 3.8)},${f1(by - 8.6)} ${f1(-bw - 2.4)},${f1(by - 11.4)}`,
    curl: `M${f1(-bw + 1.2)},${f1(by - 3)} c-3.6,-.6 -4.4,-5.4 -1.2,-5.8 c2.2,-.2 2.4,2.2 .6,2.6`,
    stub: `M${f1(-bw + 1.2)},${f1(by - 2)} l-2.2,-1.8`,
    long: `M${f1(-bw + 1.2)},${f1(by - 1)} C${f1(-bw - 7)},${f1(by + 1)} ${f1(-bw - 9)},${f1(by - 6)} ${f1(-bw - 7)},${f1(by - 10)}`,
  };
  let tail = '';
  if (sp.tail === 'bushy') tail = `<path d="M${f1(-bw + 1.2)},${f1(by - 1)} C${f1(-bw - 5)},${f1(by + 2.4)} ${f1(-bw - 12)},${f1(by - 1)} ${f1(-bw - 11.4)},${f1(by - 8.6)} C${f1(-bw - 8.4)},${f1(by - 6.4)} ${f1(-bw - 4)},${f1(by - 5)} ${f1(-bw + 1.2)},${f1(by - 3.8)} Z" fill="${c}"${st}/><path d="M${f1(-bw - 11.4)},${f1(by - 8.6)} C${f1(-bw - 11.8)},${f1(by - 5.6)} ${f1(-bw - 9.4)},${f1(by - 5)} ${f1(-bw - 8.2)},${f1(by - 6.2)} Z" fill="${sp.tip || c2}"/>`;
  else if (sp.tail !== 'none') tail = `<path d="${tails[sp.tail || 'cat']}" stroke="${ol}" stroke-width="${sp.tail === 'stub' ? 4.4 : 3.9}" fill="none" stroke-linecap="round"/><path d="${tails[sp.tail || 'cat']}" stroke="${c}" stroke-width="${sp.tail === 'stub' ? 3.2 : 2.7}" fill="none" stroke-linecap="round"/>`;
  const ears = {
    cat: `<path d="M${f1(hx - 3.8)},${f1(hy - 2.6)} L${f1(hx - 3)},${f1(hy - 8.4)} L${f1(hx)},${f1(hy - 4.4)} Z" fill="${cd}"${st}/><path d="M${f1(hx - 1)},${f1(hy - 4.4)} L${f1(hx + 1.4)},${f1(hy - 9)} L${f1(hx + 3.2)},${f1(hy - 3.6)} Z" fill="${c}"${st}/><path d="M${f1(hx - 0.2)},${f1(hy - 4.4)} L${f1(hx + 1.3)},${f1(hy - 7.3)} L${f1(hx + 2.4)},${f1(hy - 4)} Z" fill="#eaa0a4"/>`,
    pointy: `<path d="M${f1(hx - 3.6)},${f1(hy - 2.8)} L${f1(hx - 2.6)},${f1(hy - 10)} L${f1(hx + 0.6)},${f1(hy - 4)} Z" fill="${c}"${st}/><path d="M${f1(hx - 2.9)},${f1(hy - 3.6)} L${f1(hx - 2.5)},${f1(hy - 8.2)} L${f1(hx - 0.4)},${f1(hy - 4.2)} Z" fill="${sp.earIn || c2}"/>`,
    flop: `<path d="M${f1(hx - 3.6)},${f1(hy - 4)} C${f1(hx - 6.2)},${f1(hy - 3)} ${f1(hx - 6.4)},${f1(hy + 3.4)} ${f1(hx - 4.8)},${f1(hy + 4.8)} C${f1(hx - 3.4)},${f1(hy + 4)} ${f1(hx - 2.2)},${f1(hy)} ${f1(hx - 1.4)},${f1(hy - 4.2)} Z" fill="${sp.earC || cd}"${st}/>`,
    round: `<circle cx="${f1(hx - 2.2)}" cy="${f1(hy - 4)}" r="2.1" fill="${c}"${st}/><circle cx="${f1(hx - 2.2)}" cy="${f1(hy - 4)}" r="1" fill="#e8a0a0"/>`,
    fold: `<path d="M${f1(hx - 3.2)},${f1(hy - 3.6)} q2.2,-3.4 5.4,-1.2 q-2.2,1 -2.8,2.8 Z" fill="${sp.earC || cd}"${st}/>`,
  };
  // the head: a round skull, a muzzle for dogs and foxes, eye, nose
  const sn = sp.snout ?? (dog ? 1 : 0); let head = '';
  if (sn > 0) { // the muzzle goes under the skull's outline, like a real snout
    const mx = hx + hr * 0.3, len = hr * 0.55 + 1.2 + sn * 3, mh = 4.2 + sn * 0.5, my = hy + 1;
    const mc = sp.muzzleSame === false ? sp.muzzle || c2 : c;
    head += `<path d="M${f1(mx)},${f1(my - mh / 2)} L${f1(mx + len - 1.4)},${f1(my - mh / 2 + 0.5)} Q${f1(mx + len + 0.6)},${f1(my - mh / 2 + 0.6)} ${f1(mx + len + 0.5)},${f1(my + 0.4)} Q${f1(mx + len + 0.2)},${f1(my + mh / 2)} ${f1(mx + len - 1.8)},${f1(my + mh / 2)} L${f1(mx)},${f1(my + mh / 2)} Z" fill="${mc}"${st}/>`;
    head += `<path d="M${f1(mx + 0.6)},${f1(my + 0.6)} L${f1(mx + len - 1.2)},${f1(my + 0.9)} Q${f1(mx + len)},${f1(my + 1.2)} ${f1(mx + len - 1.8)},${f1(my + mh / 2 - 0.2)} L${f1(mx + 0.6)},${f1(my + mh / 2 - 0.2)} Z" fill="${sp.muzzle || c2}"/>`;
    head += `<ellipse cx="${f1(mx + len - 0.1)}" cy="${f1(my - mh / 2 + 1.1)}" rx="1.45" ry="1.1" fill="${sp.nose || '#2a2320'}"/><path d="M${f1(mx + len - 3.4)},${f1(my + 0.9)} q1.3,.7 2.5,-.2" stroke="#2a2320" stroke-width=".55" fill="none" stroke-linecap="round"/>`;
  }
  head += `<ellipse cx="${f1(hx)}" cy="${f1(hy)}" rx="${f1(hr)}" ry="${f1(hr * 0.94)}" fill="${c}"${st}/>`;
  if (sn > 0) head += `<ellipse cx="${f1(hx + hr * 0.62)}" cy="${f1(hy + 1.6)}" rx="${f1(hr * 0.5)}" ry="${f1(hr * 0.42)}" fill="${c}"/>`; // blends the snout into the head
  if (sp.mask) head += `<path d="M${f1(hx + 0.6)},${f1(hy - hr + 1.2)} A${f1(hr)},${f1(hr * 0.94)} 0 0 1 ${f1(hx + hr)},${f1(hy + 0.6)} L${f1(hx + 1.2)},${f1(hy + 1.6)} Z" fill="${sp.mask}"/>`;
  if (sn > 0) { /* drawn above */ } else {
    head += `<ellipse cx="${f1(hx + hr * 0.62)}" cy="${f1(hy + 1.7)}" rx="2.5" ry="1.8" fill="${sp.muzzle || tone(c, 0.3)}"/><path d="M${f1(hx + hr * 0.62 + 1.6)},${f1(hy + 0.6)} l1.3,.2 l-.8,.9 Z" fill="${sp.nose || '#e27a8a'}"/>`;
    if (sp.kind === 'cat') head += `<path d="M${f1(hx + hr - 0.4)},${f1(hy + 1.9)} l5,-.8 M${f1(hx + hr - 0.4)},${f1(hy + 2.5)} l5,.5" stroke="#fff" stroke-width=".35" opacity=".85"/>`;
  }
  const ex = hx + (sn > 0 ? 2.2 : 1.9), ey = hy - (sn > 0 ? 1.8 : 1.3);
  head += `<g data-p="eyes" data-px="${f1(ex)}" data-py="${f1(ey)}">${sp.kind === 'cat' ? `<ellipse cx="${f1(ex)}" cy="${f1(ey)}" rx="1.25" ry="1.45" fill="${sp.eye || '#8bc34a'}"/><ellipse cx="${f1(ex + 0.25)}" cy="${f1(ey)}" rx=".42" ry="1.15" fill="#111"/>` : `<circle cx="${f1(ex)}" cy="${f1(ey)}" r="1.05" fill="${sp.eye || '#2a2320'}"/><circle cx="${f1(ex + 0.35)}" cy="${f1(ey - 0.35)}" r=".35" fill="#fff"/>`}</g>`;
  head += ears[sp.ear || (dog ? 'flop' : 'cat')] || '';
  if (sp.collar) head += `<path d="M${f1(hx - 3.4)},${f1(hy + 3.6)} q2.4,2 5.2,1.2" stroke="${sp.collar}" stroke-width="1.6" fill="none"/><circle cx="${f1(hx - 0.4)}" cy="${f1(hy + 5.4)}" r=".9" fill="#e8b93c"/>`;
  // body: a soft bean, deeper at the chest
  let body = `<path d="M${f1(-bw)},${f1(by + 0.6)} C${f1(-bw)},${f1(by - bh * 1.05)} ${f1(bw * 0.2)},${f1(by - bh * 1.12)} ${f1(bw * 0.72)},${f1(by - bh * 0.95)} C${f1(bw * 1.1)},${f1(by - bh * 0.7)} ${f1(bw * 1.12)},${f1(by + bh * 0.9)} ${f1(bw * 0.55)},${f1(by + bh * 0.95)} L${f1(-bw * 0.6)},${f1(by + bh * 0.9)} C${f1(-bw * 0.95)},${f1(by + bh * 0.85)} ${f1(-bw)},${f1(by + bh * 0.4)} ${f1(-bw)},${f1(by + 0.6)} Z" fill="${c}"${st}/>`;
  if (sp.belly !== false) body += `<path d="M${f1(-bw * 0.4)},${f1(by + bh * 0.82)} Q${f1(bw * 0.3)},${f1(by + bh * 0.2)} ${f1(bw * 0.95)},${f1(by + bh * 0.1)} Q${f1(bw * 1.05)},${f1(by + bh * 0.7)} ${f1(bw * 0.5)},${f1(by + bh * 0.9)} Z" fill="${c2}" opacity=".95"/>`;
  const rnd = mulberry(sp.seed || 7);
  if (sp.pat === 'stripes') body += Array.from({ length: 4 }, (_, i) => `<path d="M${f1(-bw * 0.62 + i * bw * 0.36)},${f1(by - bh * 0.95)} q1.2,2.4 .2,4.6" stroke="${sp.c2 && sp.c2 !== c ? sp.c2 : cd}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`).join('');
  if (sp.pat === 'spots') body += Array.from({ length: 7 }, () => `<ellipse cx="${f1((rnd() - 0.5) * bw * 1.5)}" cy="${f1(by + (rnd() - 0.65) * bh)}" rx="${f1(0.9 + rnd() * 1.1)}" ry="${f1(0.8 + rnd() * 0.7)}" fill="${sp.spot || '#2a2320'}"/>`).join('');
  if (sp.pat === 'patches') body += `<path d="M${f1(-bw * 0.8)},${f1(by - bh * 0.6)} Q${f1(-bw * 0.3)},${f1(by - bh * 1.3)} ${f1(bw * 0.05)},${f1(by - bh * 0.7)} Q${f1(-bw * 0.1)},${f1(by + bh * 0.3)} ${f1(-bw * 0.8)},${f1(by + bh * 0.1)} Z" fill="${sp.spot}"/>` + (sp.spot2 ? `<ellipse cx="${f1(bw * 0.45)}" cy="${f1(by - bh * 0.4)}" rx="${f1(bw * 0.2)}" ry="${f1(bh * 0.45)}" fill="${sp.spot2}"/>` : '');
  if (sp.pat === 'saddle') body += `<path d="M${f1(-bw * 0.85)},${f1(by - bh * 0.2)} Q${f1(-bw * 0.4)},${f1(by - bh * 1.15)} ${f1(bw * 0.5)},${f1(by - bh * 0.9)} Q${f1(bw * 0.1)},${f1(by - bh * 0.1)} ${f1(-bw * 0.85)},${f1(by - bh * 0.2)} Z" fill="${sp.spot}"/>`;
  if (sp.fluffy) body += Array.from({ length: 7 }, (_, i) => `<circle cx="${f1(-bw + 1.6 + i * (bw * 2 - 3.6) / 6)}" cy="${f1(by - bh * 0.5 + (i % 2) * 1.4)}" r="${f1(bh * 0.55)}" fill="${c}"${st}/>`).join('');
  const walk = `<g data-pose="walk"><g data-p="tail" data-px="${f1(-bw + 1.2)}" data-py="${f1(by - 1.4)}">${tail}</g>${leg(-bw * 0.52, true, true)}${leg(bw * 0.62, true, false)}<g data-p="torso">${body}</g>${leg(-bw * 0.7, false, true)}${leg(bw * 0.4, false, false)}<g data-p="head" data-px="${f1(hx - 3)}" data-py="${f1(hy + 3)}">${head}</g></g>`;
  // resting: lying down, paws in front, eyes closed
  const ly = -bh * 0.95; const closed = head.replace(/<g data-p="eyes"[\s\S]*?<\/g>/, `<path d="M${f1(ex - 1.1)},${f1(ey)} q1.1,1 2.2,0" stroke="#2a2320" stroke-width=".75" fill="none" stroke-linecap="round"/>`);
  const restTail = sp.tail === 'none' ? '' : `<path d="M${f1(-bw + 1)},${f1(ly + 2.6)} C${f1(-bw - 5)},${f1(ly + 4.6)} ${f1(-bw - 2)},${f1(-0.6)} ${f1(bw * 0.1)},${f1(-0.8)}" stroke="${ol}" stroke-width="${sp.tail === 'bushy' ? 5.8 : 3.9}" fill="none" stroke-linecap="round"/><path d="M${f1(-bw + 1)},${f1(ly + 2.6)} C${f1(-bw - 5)},${f1(ly + 4.6)} ${f1(-bw - 2)},${f1(-0.6)} ${f1(bw * 0.1)},${f1(-0.8)}" stroke="${c}" stroke-width="${sp.tail === 'bushy' ? 4.6 : 2.7}" fill="none" stroke-linecap="round"/>`;
  let rbody = `<ellipse cx="0" cy="${f1(ly + 1.4)}" rx="${f1(bw)}" ry="${f1(bh * 0.92)}" fill="${c}"${st}/>`;
  if (sp.pat === 'stripes') rbody += Array.from({ length: 3 }, (_, i) => `<path d="M${f1(-bw * 0.5 + i * bw * 0.4)},${f1(ly - bh * 0.62 + 1.2)} q1,2 0,3.6" stroke="${sp.c2 && sp.c2 !== c ? sp.c2 : cd}" stroke-width="1.4" fill="none"/>`).join('');
  if (sp.pat === 'spots') rbody += `<circle cx="${f1(-bw * 0.3)}" cy="${f1(ly + 0.4)}" r="1.3" fill="${sp.spot || '#2a2320'}"/><circle cx="${f1(bw * 0.25)}" cy="${f1(ly + 1.4)}" r="1" fill="${sp.spot || '#2a2320'}"/><circle cx="${f1(-bw * 0.7)}" cy="${f1(ly + 2)}" r=".9" fill="${sp.spot || '#2a2320'}"/>`;
  if (sp.pat === 'patches' || sp.pat === 'saddle') rbody += `<ellipse cx="${f1(-bw * 0.3)}" cy="${f1(ly + 0.2)}" rx="${f1(bw * 0.42)}" ry="${f1(bh * 0.55)}" fill="${sp.spot}"/>`;
  if (sp.fluffy) rbody += Array.from({ length: 5 }, (_, i) => `<circle cx="${f1(-bw + 2 + i * (bw * 2 - 4) / 4)}" cy="${f1(ly - bh * 0.3)}" r="${f1(bh * 0.5)}" fill="${c}"${st}/>`).join('');
  const rest = `<g data-pose="rest" display="none">${restTail}${rbody}<ellipse cx="${f1(bw * 0.95)}" cy="-1.2" rx="3.2" ry="1.3" fill="${sp.socks || sp.paws ? c2 : c}"${st}/><ellipse cx="${f1(bw * 0.7)}" cy="-0.9" rx="3" ry="1.2" fill="${sp.socks || sp.paws ? tone(c2, -0.15) : cd}"${st}/><g transform="translate(-2.2,${f1(-hy + ly - 0.6)})">${closed}</g></g>`;
  return `<ellipse cx="1" cy="-0.4" rx="${f1(bw + 2.4)}" ry="${f1(2.8 * s)}" fill="#000" opacity=".2"/><g data-p="flip"><g data-p="bob"${s !== 1 ? ` transform="scale(${s})"` : ''}>${walk}${rest}</g></g>`;
}
/* rabbits hop; the rest pose is the classic one from the shop */
function rabbitSvg(sp) {
  const c = sp.c, cd = tone(c, -0.25), st = ` stroke="${tone(c, -0.4)}" stroke-width=".7"`, pink = sp.c2 || '#f2b8c0';
  const walk = `<g data-pose="walk"><g data-p="torso"><ellipse cx="-1" cy="-8" rx="8.4" ry="6.4" fill="${c}"${st}/><circle cx="-9" cy="-9.4" r="2.8" fill="#fff"${st}/><ellipse cx="-3.6" cy="-2" rx="4.4" ry="2" fill="${cd}"${st}/></g>`
    + `<g data-p="head" data-px="5" data-py="-11"><ellipse cx="6" cy="-13.4" rx="4.8" ry="4.3" fill="${c}"${st}/><path d="M3.6,-16.6 C1.4,-24 3,-29 5,-29 C6.4,-27 6,-21 5.4,-16.8 Z" fill="${c}"${st}/><path d="M4.2,-18.4 C3.4,-23 4.2,-26 5,-26.6" stroke="${pink}" stroke-width="1.2" fill="none"/><path d="M6,-17 C6.6,-23 9.4,-27 11,-26.4 C11.4,-24 9.4,-20 7.4,-16.4 Z" fill="${cd}"${st}/><circle cx="8.2" cy="-14" r=".95" fill="#2a2320"/><circle cx="10.5" cy="-12.4" r=".8" fill="#f28c9c"/></g>`
    + `<g data-p="fr" data-px="4" data-py="-4"><ellipse cx="4.6" cy="-1.4" rx="2" ry="1.3" fill="${c}"${st}/></g></g>`;
  const rest = `<g data-pose="rest" display="none"><g transform="translate(-6,0)"><ellipse cx="4" cy="-8" rx="12" ry="9" fill="${c}"${st}/><circle cx="15" cy="-10" r="3.6" fill="#fff"${st}/><ellipse cx="-2" cy="-1" rx="6" ry="2.6" fill="${c}"${st}/><g transform="translate(-6,-16)"><ellipse cx="0" cy="0" rx="7.5" ry="6.5" fill="${c}"${st}/><path d="M-3,-5 C-6,-14 -5,-22 -2,-24 C1,-22 1,-14 -1,-5 Z" fill="${c}"${st}/><path d="M-2.4,-8 C-4,-14 -3.6,-19 -2.2,-21" stroke="${pink}" stroke-width="1.6" fill="none"/><path d="M2,-5 C3,-14 7,-21 10,-22 C12,-19 9,-12 4,-4 Z" fill="${c}"${st}/><circle cx="-3" cy="-1" r="1.4" fill="#2a2320"/><circle cx="-7" cy="2" r="1.1" fill="#f28c9c"/></g></g></g>`;
  return `<ellipse cx="0" cy="-0.4" rx="10" ry="3" fill="#000" opacity=".2"/><g data-p="flip"><g data-p="bob"><g transform="scale(1.12)">${walk}</g><g transform="scale(.82)">${rest}</g></g></g>`;
}
/* a few special walkers */
function specialWalkerSvg(sp) {
  const sh = (rx) => `<ellipse cx="0" cy="-0.4" rx="${rx}" ry="3" fill="#000" opacity=".2"/>`;
  const wrap = (w, r, rx = 10) => `${sh(rx)}<g data-p="flip"><g data-p="bob"><g data-pose="walk">${w}</g><g data-pose="rest" display="none">${r || w}</g></g></g>`;
  switch (sp.kind) {
    case 'turtle': { const c = sp.c || '#6b8e3a'; const sc = sp.c2 || '#8a6a3a';
      const legs = `<g data-p="fl" data-px="5" data-py="-4"><ellipse cx="5" cy="-2" rx="2" ry="2.4" fill="${c}"/></g><g data-p="bl" data-px="-5" data-py="-4"><ellipse cx="-5" cy="-2" rx="2" ry="2.4" fill="${c}"/></g>`;
      const shell = `<path d="M-9,-3.4 C-9,-12 9,-12 9,-3.4 Z" fill="${sc}" stroke="${tone(sc, -0.45)}" stroke-width=".8"/><path d="M-4,-4 l2,-4 h4 l2,4 M-8,-4 l3,-3 M8,-4 l-3,-3" stroke="${tone(sc, -0.35)}" stroke-width=".8" fill="none"/><rect x="-9.4" y="-4" width="18.8" height="1.6" rx=".8" fill="${tone(sc, 0.2)}"/>`;
      return wrap(`${legs}<g data-p="head" data-px="9" data-py="-4"><path d="M8,-4 C10,-6 13,-8 14.4,-6 C15.4,-4.4 13,-3 9.6,-3 Z" fill="${c}"/><circle cx="12.8" cy="-6" r=".6" fill="#111"/></g><g data-p="torso">${shell}</g>`, `<g data-p="torso">${shell}</g><circle cx="9.4" cy="-3.6" r="1.6" fill="${c}"/>`, 10); }
    case 'hedgehog': { const c = sp.c || '#8a6a4a';
      const spikes = Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.08 + i * 0.1); return `<path d="M${f1(Math.cos(a) * 7 - 1)},${f1(-4 - Math.sin(a) * 6)} l${f1(Math.cos(a) * 4 - 1)},${f1(-Math.sin(a) * 4)} l1.6,.6 Z" fill="${tone(c, -0.3)}"/>`; }).join('');
      const b = `<ellipse cx="-1" cy="-5" rx="8.4" ry="5.6" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width=".7"/>${spikes}<ellipse cx="6.2" cy="-3.8" rx="3.6" ry="2.8" fill="#e8d2b0"/><circle cx="9.6" cy="-3.6" r=".9" fill="#2a2320"/><circle cx="6.6" cy="-4.8" r=".6" fill="#111"/>`;
      return wrap(`<g data-p="fl" data-px="4" data-py="-2"><rect x="3.4" y="-2" width="1.6" height="2" fill="#6b4a2e"/></g><g data-p="bl" data-px="-5" data-py="-2"><rect x="-5.8" y="-2" width="1.6" height="2" fill="#6b4a2e"/></g><g data-p="torso">${b}</g>`, `<g data-p="torso">${b}</g>`, 9); }
    case 'penguin': {
      const b = `<g data-p="fl" data-px="-2" data-py="-1"><ellipse cx="-2" cy="-0.8" rx="2.4" ry="1" fill="#f2a41c"/></g><g data-p="fr" data-px="2.6" data-py="-1"><ellipse cx="3" cy="-0.8" rx="2.4" ry="1" fill="#f2a41c"/></g>`
        + `<g data-p="torso"><ellipse cx="0" cy="-10" rx="6.6" ry="9.6" fill="#22242c" stroke="#0d0e12" stroke-width=".7"/><ellipse cx="1.4" cy="-8.6" rx="4.4" ry="7.2" fill="#f4f1ea"/><path d="M-6,-12 C-9,-8 -8.6,-4 -6.4,-3" stroke="#22242c" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="2.4" cy="-16" r=".9" fill="#111"/><path d="M4,-15 l3.6,1 l-3.4,1 Z" fill="#f2a41c"/><ellipse cx="3" cy="-12.6" rx="1.6" ry=".8" fill="#f2c14e" opacity=".6"/></g>`;
      return wrap(b, b, 7); }
    case 'duck': { const c = sp.c || '#f7d046';
      const b = `<g data-p="fl" data-px="0" data-py="-2"><path d="M-1,-2 v2 h3" stroke="#f08a2a" stroke-width="1.2" fill="none"/></g><g data-p="torso"><ellipse cx="-1" cy="-6" rx="6.4" ry="4.8" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width=".7"/><path d="M-7,-7 l-2.4,-2 l1,3 Z" fill="${c}"/><path d="M-3,-7 q3,-2 5,1" stroke="${tone(c, -0.25)}" stroke-width=".8" fill="none"/></g><g data-p="head" data-px="4" data-py="-9"><circle cx="4.4" cy="-12.2" r="3.9" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width=".7"/><path d="M7.6,-12 l3.6,.4 l-3.4,1.6 Z" fill="#f08a2a"/><circle cx="5.6" cy="-13.2" r=".7" fill="#111"/></g>`;
      return wrap(b, b, 7); }
    case 'frog': { const c = sp.c || '#6cbf63';
      const b = `<g data-p="torso"><ellipse cx="0" cy="-5" rx="7" ry="4.8" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width=".7"/><ellipse cx="1" cy="-3.4" rx="4.6" ry="2.4" fill="#e8f0c0"/><path d="M-6,-2 q-3,1 -1,2.4 h4 M5,-2 q2,1 1,2.4" stroke="${tone(c, -0.2)}" stroke-width="1.4" fill="none"/></g><g data-p="head" data-px="3" data-py="-8"><circle cx="1" cy="-9.6" r="2.4" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width=".7"/><circle cx="5.4" cy="-9.4" r="2.4" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width=".7"/><circle cx="1.4" cy="-9.8" r="1.1" fill="#111"/><circle cx="5.8" cy="-9.6" r="1.1" fill="#111"/><path d="M1,-5.6 q3,1.6 6,0" stroke="#2f5a2a" stroke-width=".7" fill="none"/></g>`;
      return wrap(b, b, 8); }
    case 'vacuum': {
      const b = `<g data-p="torso"><ellipse cx="0" cy="-2.4" rx="10" ry="5" fill="#2b2d33" stroke="#111" stroke-width=".7"/><ellipse cx="0" cy="-4.2" rx="10" ry="5" fill="#3a3d45" stroke="#111" stroke-width=".7"/><ellipse cx="0" cy="-4.6" rx="6.4" ry="3.1" fill="#4a4e58"/><circle cx="3.6" cy="-5.2" r="1" fill="#6cf06c"/><path d="M-6,-3 a7,3.4 0 0 0 12,0" stroke="#8e96a0" stroke-width=".7" fill="none"/></g>`;
      return wrap(b, b, 11); }
    case 'hamster': { const c = sp.c || '#e8b070';
      const b = `<g data-p="torso"><circle cx="0" cy="-8.6" r="8.4" fill="#cfefff" fill-opacity=".25" stroke="#dff3fb" stroke-width="1"/><g data-p="spin" data-px="0" data-py="-8.6"><path d="M-8,-8.6 h16 M0,-17 v16.8" stroke="#dff3fb" stroke-width=".6" opacity=".7"/></g><ellipse cx="0.6" cy="-5.8" rx="4.4" ry="3.3" fill="${c}"/><ellipse cx="1.4" cy="-4.8" rx="2.6" ry="1.6" fill="#fff4e0"/><circle cx="3.6" cy="-7.4" r="2.6" fill="${c}"/><circle cx="4.8" cy="-8" r=".6" fill="#111"/><circle cx="2.4" cy="-9.4" r="1" fill="#f2b0a0"/><path d="M-5,-15 a8.4,8.4 0 0 1 8,-2" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/></g>`;
      return wrap(b, b, 9); }
    default: return quadSvg(sp);
  }
}
function walkerSvg(sp) {
  if (sp.kind === 'rabbit') return rabbitSvg(sp);
  if (['turtle', 'hedgehog', 'penguin', 'duck', 'frog', 'vacuum', 'hamster'].includes(sp.kind)) return specialWalkerSvg(sp);
  return quadSvg({ ...sp, ...(WALKER_BASE[sp.kind] || {}), ...sp });
}
/* how each kind of animal is built and behaves */
const WALKER_BASE = {
  cat: { ear: 'cat', tail: 'cat', snout: 0, legs: 1, body: 1 },
  dog: { ear: 'flop', tail: 'wag', snout: 1, legs: 1.15, body: 1.15, head: 5.8 },
  fox: { ear: 'pointy', tail: 'bushy', snout: 1, legs: 1.05, body: 1.05, earIn: '#2a2320' },
  pig: { ear: 'fold', tail: 'curl', snout: 0.5, legs: 0.75, body: 1.1, head: 5.6, belly: false, nose: '#e27a8a' },
  guinea: { ear: 'round', tail: 'none', snout: 0.2, legs: 0.35, body: 0.9, head: 5, belly: false },
  robodog: { ear: 'pointy', tail: 'stub', snout: 0.8, legs: 1.1, body: 1.05, belly: false },
};
const WALK_TRAITS = { // speed (tiles a second), how long it rests, how it moves; legAmp: leg swing (degrees), wag: [speed, degrees] of the tail
  avatar: { speed: 1.15, rest: [2.5, 8], legAmp: 17 }, cat: { speed: 0.95, rest: [4, 14], nap: 0.35, legAmp: 16, wag: [2.2, 8] }, dog: { speed: 1.45, rest: [3, 10], follow: 0.45, nap: 0.25, legAmp: 18, wag: [9, 13] },
  rabbit: { speed: 1.3, rest: [1.5, 6], hop: true, legAmp: 16, wag: [3, 5] }, fox: { speed: 1.25, rest: [3, 9], nap: 0.2, legAmp: 16, wag: [2, 7] }, pig: { speed: 0.8, rest: [4, 12], nap: 0.3, legAmp: 14, wag: [5, 10] },
  guinea: { speed: 0.7, rest: [2, 7], legAmp: 10 }, robodog: { speed: 1.1, rest: [2, 6], follow: 0.35, legAmp: 15, wag: [10, 14] }, turtle: { speed: 0.22, rest: [6, 16], legAmp: 9 },
  hedgehog: { speed: 0.6, rest: [3, 10], legAmp: 10 }, penguin: { speed: 0.55, rest: [2, 8], waddle: true }, duck: { speed: 0.7, rest: [2, 7], waddle: true },
  frog: { speed: 1.0, rest: [2, 9], hop: true }, vacuum: { speed: 0.6, rest: [0.5, 2], roll: true }, hamster: { speed: 1.0, rest: [1, 4], roll: true },
};

/* ---------- moving them around ---------- */
const SKEW = Math.atan(0.5) * 180 / Math.PI;
const AVATAR_LINES = () => {
  const cr = Credits.get(); const tk = todayKey(); const today = (netByDay(tk, tk).get(tk)?.net || 0) / MIN; const sk = streakInfo();
  const av = avatarOf(); const lines = ['Nice room, right?', 'One more puzzle…', 'Deep breath.', 'Focus mode: on.', 'Time for a stretch.', `Level ${cr.level}, ${cr.title}!`, 'Coffee first.', 'Every mistake is a lesson.', 'Where did I leave that book?', 'Calm mind, sharp moves.'];
  if (today >= 1) lines.push(`${fmtHM(today)} of study today!`, `${fmtHM(today)} today. Not bad!`);
  if (sk.current >= 2) lines.push(`${sk.current}-day streak!`);
  if (av.name) lines.push(`Hi, I'm ${av.name}!`);
  return lines;
};
const Actors = {
  svg: null, rid: null, list: [], raf: 0, last: 0, occ: null, statics: [], layer: null, mem: {}, entry: null, io: null, onScreen: true, frame: 0, still: false,
  reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },
  unmount() { cancelAnimationFrame(this.raf); this.raf = 0; if (this.io) { this.io.disconnect(); this.io = null; } if (this.onVis) { document.removeEventListener('visibilitychange', this.onVis); this.onVis = null; } this.save(); this.list = []; this.svg = null; },
  save() { if (!this.rid) return; const m = this.mem[this.rid] = this.mem[this.rid] || {}; for (const a of this.list) m[a.id] = { x: a.x, y: a.y, face: a.face }; },
  arrive(rid, from) { this.save(); this.entry = from ? { rid, from } : null; },
  free(i, j) { return i >= 0 && j >= 0 && i < ISO.N && j < ISO.N && !this.occ[i][j]; },
  tileOf(a) { return [clamp(Math.floor(a.x), 0, ISO.N - 1), clamp(Math.floor(a.y), 0, ISO.N - 1)]; },
  freeTiles() { const out = []; for (let i = 0; i < ISO.N; i++) for (let j = 0; j < ISO.N; j++) if (this.free(i, j)) out.push([i, j]); return out; },
  nearestFree(i, j) { let best = null, bd = 1e9; for (const [a, b] of this.freeTiles()) { const d = Math.abs(a - i) + Math.abs(b - j); if (d < bd) { bd = d; best = [a, b]; } } return best; },
  /* the free tiles reachable from here, with the path to each (breadth first, four directions) */
  paths(i, j) {
    const prev = new Map(); const key = (a, b) => a * 16 + b; prev.set(key(i, j), null); const q = [[i, j]]; const dist = new Map([[key(i, j), 0]]);
    while (q.length) { const [a, b] = q.shift(); for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const na = a + da, nb = b + db; if (!this.free(na, nb) || prev.has(key(na, nb))) continue; prev.set(key(na, nb), [a, b]); dist.set(key(na, nb), dist.get(key(a, b)) + 1); q.push([na, nb]); } }
    return { dist, route: (a, b) => { const out = []; let cur = [a, b]; while (cur && !(cur[0] === i && cur[1] === j)) { out.unshift(cur); cur = prev.get(key(cur[0], cur[1])); } return out; } };
  },
  mount(svg, rid, { editing = false } = {}) {
    this.unmount(); this.rid = rid; if (!svg || editing) return;
    this.svg = svg; this.layer = $('.rm-solids', svg); if (!this.layer) return;
    const placed = Room.placedList(rid);
    this.occ = Array.from({ length: ISO.N }, () => new Array(ISO.N).fill(false));
    for (const e of placed) if (!e.wall && e.layer === 'solid' && !e.it.walker) for (let i = e.x; i < e.x + e.w; i++) for (let j = e.y; j < e.y + e.d; j++) if (i < ISO.N && j < ISO.N) this.occ[i][j] = true;
    const geo = new Map(placed.filter((e) => !e.wall).map((e) => [e.o.uid, e]));
    this.statics = $$(':scope > .rm-item', this.layer).map((node) => ({ node, e: geo.get(node.dataset.uid) })).filter((s) => s.e);
    // who is here: you, and the animals that walk
    const avArt = artAvatarSvg(avatarOf());
    const specs = [{ id: 'avatar', kind: 'avatar', svg: avArt || avatarSvg(avatarOf()), raster: !!avArt }];
    for (const e of placed) if (e.it.walker) { const art = artWalkerSvg(e.it); specs.push({ id: e.o.uid, kind: e.it.walker.kind, svg: art || walkerSvg(e.it.walker), raster: !!art, home: [e.x, e.y], it: e.it }); }
    const mem = this.mem[rid] || {}; const entry = this.entry && this.entry.rid === rid ? this.entry : null; this.entry = null;
    this.list = [];
    for (const sp of specs) {
      let pos = null; const m = mem[sp.id];
      if (sp.id === 'avatar' && entry) { const dr = roomDoors(rid).find((d) => d.to === entry.from); if (dr && this.free(dr.tile[0], dr.tile[1])) pos = dr.tile; }
      if (!pos && m && this.free(Math.floor(m.x), Math.floor(m.y))) pos = [Math.floor(m.x), Math.floor(m.y)];
      if (!pos && sp.home && this.free(sp.home[0], sp.home[1])) pos = sp.home;
      if (!pos) { const ft = this.freeTiles(); if (!ft.length) continue; const rnd = mulberry(sp.id.length * 31 + rid.length); const mid = ft.filter(([i, j]) => Math.abs(i - 3.5) + Math.abs(j - 3.5) < 4); const pool = mid.length ? mid : ft; pos = pool[Math.floor(rnd() * pool.length)]; }
      const a = { ...sp, x: pos[0] + 0.5, y: pos[1] + 0.5, path: [], state: 'idle', t: 0.8 + Math.random() * 2.5, face: m?.face || { sx: Math.random() < 0.5 ? 1 : -1, back: false }, phase: 0, pose: 'walk', key: '', traits: WALK_TRAITS[sp.kind] || WALK_TRAITS.cat, wave: 0, bubbleT: 0, blinkT: 2 + Math.random() * 3 };
      if (sp.id === 'avatar' && entry) { a.t = 0.2; a.entering = true; }
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'rm-actor ' + (sp.kind === 'avatar' ? 'avatar' : 'pet')); g.dataset.actor = sp.id; g.innerHTML = sp.svg + '<g class="rm-bubble-slot"></g>';
      a.node = g; a.parts = {}; $$('[data-p]', g).forEach((n) => { (a.parts[n.dataset.p] ||= []).push(n); });
      a.poses = {}; $$('[data-pose]', g).forEach((n) => { a.poses[n.dataset.pose] = n; });
      // the moving parts of a Canva figure, per pose (the body itself only breathes)
      a.qs = {}; for (const [k, n] of Object.entries(a.poses)) a.qs[k] = $$('[data-q]', n).filter((q) => q.dataset.q !== 'b').map((q) => ({ n: q, t: q.dataset.q, g: +q.dataset.g, px: q.dataset.px, py: q.dataset.py, last: 0 }));
      a.seed = Math.random() * 6;
      this.list.push(a);
    }
    this.still = this.reduced();
    for (const a of this.list) { this.place(a); this.render(a, 0); }
    this.depth(true);
    if (this.still) return;
    this.io = new IntersectionObserver((ents) => { this.onScreen = ents.some((x) => x.isIntersecting); if (this.onScreen) this.kick(); }, { threshold: 0.02 });
    this.io.observe(svg);
    this.onVis = () => { if (!document.hidden) this.kick(); }; document.addEventListener('visibilitychange', this.onVis);
    this.kick();
  },
  kick() { if (this.raf || !this.svg) return; this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.loop(t)); },
  loop(t) {
    this.raf = 0; if (!this.svg || !this.svg.isConnected) { this.unmount(); return; }
    if (document.hidden || !this.onScreen) return; // resumes when the room is visible again
    const dt = Math.min(0.1, (t - this.last) / 1000);
    const busy = this.list.some((a) => a.state === 'walk' || a.wave > 0); // idle figures only breathe: fewer frames
    if (dt >= (busy ? 1 / 32 : 1 / 12)) { this.last = t; for (const a of this.list) this.step(a, dt); this.depth(false); }
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
  },
  /* where to go next: somewhere nearby, a sunny or soft spot, or after you (dogs) */
  decide(a) {
    const tr = a.traits; const [i, j] = this.tileOf(a); const P2 = this.paths(i, j); const rnd = Math.random();
    const cands = []; for (const [k, d] of P2.dist) { const ti = Math.floor(k / 16), tj = k % 16; if (d >= 1 && d <= (a.kind === 'avatar' ? 7 : a.kind === 'turtle' ? 2 : 5)) cands.push([ti, tj, d]); }
    if (a.kind !== 'avatar' && tr.nap && rnd < tr.nap) { a.state = 'rest'; a.t = 8 + Math.random() * 16; return; }
    if (tr.follow && Math.random() < tr.follow) {
      const av = this.list.find((x) => x.id === 'avatar'); if (av) { const [ai, aj] = this.tileOf(av); const near = cands.filter(([ti, tj]) => Math.abs(ti - ai) + Math.abs(tj - aj) === 1); if (near.length) { const pick = near[Math.floor(Math.random() * near.length)]; a.path = P2.route(pick[0], pick[1]); a.state = 'walk'; return; } }
    }
    if (a.id !== 'avatar' && a.home && Math.random() < 0.18 && this.free(a.home[0], a.home[1]) && P2.dist.has(a.home[0] * 16 + a.home[1]) && !(i === a.home[0] && j === a.home[1])) { a.path = P2.route(a.home[0], a.home[1]); a.state = 'walk'; a.thenRest = true; return; }
    if (!cands.length || (a.kind === 'avatar' && Math.random() < 0.18)) { a.state = 'idle'; a.t = tr.rest[0] + Math.random() * (tr.rest[1] - tr.rest[0]); if (Math.random() < 0.5) a.face = { ...a.face, sx: -a.face.sx, back: false }; return; }
    const pick = cands[Math.floor(Math.random() * cands.length)]; a.path = P2.route(pick[0], pick[1]); a.state = 'walk';
  },
  step(a, dt) {
    const tr = a.traits;
    if (a.wave > 0) a.wave -= dt;
    if (a.bubbleT > 0) { a.bubbleT -= dt; if (a.bubbleT <= 0) this.bubble(a, null); }
    if (a.state === 'walk') {
      if (!a.path.length) { a.state = a.thenRest ? 'rest' : 'idle'; a.thenRest = false; a.t = a.state === 'rest' ? 10 + Math.random() * 14 : tr.rest[0] + Math.random() * (tr.rest[1] - tr.rest[0]); a.face = { ...a.face, back: false }; this.render(a, dt); return; }
      const [ni, nj] = a.path[0]; if (!this.free(ni, nj)) { a.path = []; return; }
      const tx = ni + 0.5, ty = nj + 0.5; const dx = tx - a.x, dy = ty - a.y; const d = Math.hypot(dx, dy); const mv = tr.speed * dt;
      if (Math.abs(dx) > 1e-3 || Math.abs(dy) > 1e-3) { const hx2 = Math.abs(dx) > Math.abs(dy); a.face = hx2 ? (dx > 0 ? { sx: 1, back: false } : { sx: -1, back: true }) : (dy > 0 ? { sx: -1, back: false } : { sx: 1, back: true }); a.dir = hx2 ? (dx > 0 ? 'x+' : 'x-') : (dy > 0 ? 'y+' : 'y-'); }
      if (d <= mv) { a.x = tx; a.y = ty; a.path.shift(); } else { a.x += (dx / d) * mv; a.y += (dy / d) * mv; }
      a.phase += mv * (a.kind === 'avatar' ? 9 : tr.hop ? 7 : 11);
    } else {
      a.t -= dt; if (a.t <= 0) { if (a.state === 'rest') { a.state = 'idle'; a.t = 0.6; } else this.decide(a); }
      if (a.id === 'avatar' && a.state === 'idle' && !a.bubbleT && Math.random() < dt / 70) this.bubble(a, ['♪', '…', '!', '?', '♞', '♥'][Math.floor(Math.random() * 6)], 2.2, true);
    }
    this.place(a); this.render(a, dt);
  },
  place(a) { a.node.setAttribute('transform', `translate(${f1(isoX(a.x, a.y))},${f1(isoY(a.x, a.y))})`); },
  setT(list, v) { if (list) for (const n of list) n.setAttribute('transform', v); },
  rot(a, name, deg) { const l = a.parts[name]; if (!l) return; for (const n of l) n.setAttribute('transform', `rotate(${f1(deg)} ${n.dataset.px} ${n.dataset.py})`); },
  /* the Canva figures: pick the picture for the direction; legs swing in turns, the head nods, the tail wags,
     and standing still the body breathes. Moving from tile to tile is interpolated in step(). */
  renderArt(a) {
    const walking = a.state === 'walk'; const s = Math.sin(a.phase); const tt = performance.now() / 1000; const tr = a.traits || {};
    const dk = { 'x+': 'xp', 'x-': 'xm', 'y+': 'yp', 'y-': 'ym' }[a.dir];
    let pose = 'idle';
    if (walking) pose = dk || 'idle';
    else if (a.kind !== 'avatar' && a.state === 'idle' && dk) pose = dk; // a pet pausing keeps facing its way
    if (a.pose !== pose) { for (const [k, n] of Object.entries(a.poses)) n.setAttribute('display', k === pose ? 'inline' : 'none'); a.pose = pose; }
    const still = this.still; const qs = a.qs && a.qs[pose];
    if (qs) for (const q of qs) {
      let deg = 0;
      if (still) deg = 0;
      else if (q.t === 'l') deg = walking ? (tr.hop ? Math.sin(a.phase * 0.5) : q.g ? -s : s) * (tr.legAmp || 14) : 0;
      else if (q.t === 'h') deg = walking ? Math.sin(a.phase * 2) * 1.6 : Math.sin(tt * 0.9 + a.seed) * 2.6;
      else if (q.t === 't' && tr.wag) deg = Math.sin(tt * tr.wag[0] * (walking ? 1.5 : 1) + a.seed) * tr.wag[1];
      deg = Math.round(deg * 10) / 10;
      if (deg !== q.last) { q.n.setAttribute('transform', deg ? `rotate(${deg} ${q.px} ${q.py})` : ''); q.last = deg; }
    }
    let by = 0, rot = 0, sy = 1;
    if (walking && tr.hop) by = -Math.abs(Math.sin(a.phase * 0.5)) * 5;
    else if (walking && tr.waddle) rot = s * 6;
    else if (walking) by = -Math.abs(s) * (a.kind === 'avatar' ? 1.6 : 1);
    else if (!still && !tr.roll) sy = 1 + Math.sin(tt * 2.1 + (a.seed || 0)) * 0.018; // breathing
    if (a.wave > 0) by -= Math.abs(Math.sin(tt * 9)) * 3;
    this.setT(a.parts.bob, `translate(0,${f1(by)})${rot ? ` rotate(${f1(rot)})` : ''}${sy !== 1 ? ` scale(1,${sy.toFixed(3)})` : ''}`);
  },
  render(a, dt) {
    if (a.raster) { this.renderArt(a); return; }
    const walking = a.state === 'walk'; const s = Math.sin(a.phase); const tt = performance.now() / 1000;
    if (a.kind === 'avatar') {
      const back = walking && a.face.back;
      if (a.poses.front) a.poses.front.setAttribute('display', back ? 'none' : 'inline'); if (a.poses.back) a.poses.back.setAttribute('display', back ? 'inline' : 'none');
      this.setT(a.parts.flip, a.face.sx < 0 ? 'scale(-1,1)' : '');
      const sw = walking ? s * 26 : 0;
      this.rot(a, 'legB', sw); this.rot(a, 'legF', -sw);
      this.rot(a, 'armB', walking ? -s * 24 : 0);
      if (a.wave > 0 && !back) this.rot(a, 'armF', -150 + Math.sin(tt * 14) * 16); else this.rot(a, 'armF', walking ? s * 24 : Math.sin(tt * 1.6) * 2);
      this.rot(a, 'tail', walking ? s * 10 : Math.sin(tt * 2) * 3);
      this.setT(a.parts.bob, `translate(0,${f1(walking ? -Math.abs(s) * 1.3 : Math.sin(tt * 2.2) * 0.3)})`);
      this.rot(a, 'head', walking ? s * 2 : Math.sin(tt * 0.7) * 3);
    } else {
      const resting = a.state === 'rest'; const tr = a.traits;
      if (a.poses.walk) a.poses.walk.setAttribute('display', resting && a.poses.rest ? 'none' : 'inline'); if (a.poses.rest) a.poses.rest.setAttribute('display', resting ? 'inline' : 'none');
      const skew = walking || a.lastSkew ? (a.dir === 'x+' || a.dir === 'y+' ? SKEW : -SKEW) : 0; if (walking) a.lastSkew = true;
      const sx = a.face.sx < 0 ? -1 : 1;
      this.setT(a.parts.flip, resting ? (sx < 0 ? 'scale(-1,1)' : '') : `scale(${sx},1) skewY(${f1(a.dir ? skew : 0)})`);
      const leg = walking ? s * 26 : 0;
      this.rot(a, 'fl', leg); this.rot(a, 'br', leg); this.rot(a, 'fr', -leg); this.rot(a, 'bl', -leg);
      this.rot(a, 'tail', a.kind === 'dog' ? Math.sin(tt * (walking ? 16 : 9)) * 16 : Math.sin(tt * 2.4) * 8);
      this.rot(a, 'spin', a.phase * 60);
      let by = 0, rot = 0;
      if (walking && tr.hop) by = -Math.abs(Math.sin(a.phase * 0.5)) * 5;
      else if (walking && tr.waddle) rot = s * 8;
      else if (walking) by = -Math.abs(s) * 0.8;
      else if (!resting) by = Math.sin(tt * 2) * 0.25;
      this.setT(a.parts.bob, `translate(0,${f1(by)})${rot ? ` rotate(${f1(rot)})` : ''}`);
      this.rot(a, 'head', walking ? s * 3 : Math.sin(tt * 0.9 + a.x) * 5);
    }
    // blink now and then
    a.blinkT -= dt; const eyes = a.parts.eyes; if (eyes) { const closed = a.blinkT < 0.12; for (const n of eyes) n.setAttribute('transform', closed ? `translate(0,${n.dataset.py}) scale(1,0.15) translate(0,${-n.dataset.py})` : ''); if (a.blinkT < 0) a.blinkT = 2.5 + Math.random() * 4; }
  },
  /* put each figure right after the last thing standing behind it */
  depth(force) {
    if (!this.layer) return; let changed = force;
    for (const a of this.list) { const k = `${Math.round(a.x * 4)},${Math.round(a.y * 4)}`; if (k !== a.key) { a.key = k; changed = true; } }
    if (!changed) return;
    const box = (a) => ({ x: a.x - 0.22, y: a.y - 0.22, w: 0.44, d: 0.44 });
    const behind = (p, q) => (p.x + p.w <= q.x + 1e-6 && !(q.y + q.d <= p.y + 1e-6)) || (p.y + p.d <= q.y + 1e-6 && !(q.x + q.w <= p.x + 1e-6));
    const ov = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.d && q.y < p.y + p.d;
    const idx = (a) => { const b = box(a); let after = -1; this.statics.forEach((s, i) => { const e = s.e; if (e.layer === 'hang' && ov(e, b)) return; if (behind(e, b) || (ov(e, b) && e.layer !== 'hang')) after = i; }); return after + 1; };
    const order = this.list.map((a) => ({ a, i: idx(a) })).sort((p, q) => p.i - q.i || (p.a.x + p.a.y) - (q.a.x + q.a.y));
    for (const { a, i } of order) { const ref = this.statics[i]?.node || null; if (a.node.parentNode !== this.layer || a.node.nextSibling !== ref || a.dirty) this.layer.insertBefore(a.node, ref); }
    // keep figures that share a slot in order among themselves
    for (let k = 1; k < order.length; k++) if (order[k].i === order[k - 1].i) { const prev = order[k - 1].a.node; if (prev.nextSibling !== order[k].a.node) this.layer.insertBefore(order[k].a.node, prev.nextSibling); }
  },
  bubble(a, text, secs = 3, thought = false) {
    const slot = $('.rm-bubble-slot', a.node); if (!slot) return;
    if (!text) { slot.innerHTML = ''; a.bubbleT = 0; return; }
    const w = Math.max(16, text.length * 5.6 + 12); const top = a.kind === 'avatar' ? -58 : -30;
    slot.innerHTML = `<g class="rm-bubble${thought ? ' thought' : ''}" transform="translate(0,${top})"><rect x="${f1(-w / 2)}" y="-11" width="${f1(w)}" height="15" rx="7" fill="#fffdf6" stroke="#2b2118" stroke-width=".8"/>${thought ? '<circle cx="-2" cy="7" r="1.8" fill="#fffdf6" stroke="#2b2118" stroke-width=".6"/><circle cx="-4" cy="11" r="1" fill="#fffdf6" stroke="#2b2118" stroke-width=".5"/>' : '<path d="M-3,3.6 L0,8 L3,3.6" fill="#fffdf6" stroke="#2b2118" stroke-width=".8"/><rect x="-3.6" y="2" width="7.2" height="2" fill="#fffdf6"/>'}<text x="0" y="0" font-size="8.4" text-anchor="middle" fill="#2b2118" font-family="system-ui, sans-serif" font-weight="600">${esc(text)}</text></g>`;
    a.bubbleT = secs;
  },
  tap(id) {
    const a = this.list.find((x) => x.id === id); if (!a) return;
    if (a.kind === 'avatar') { const L2 = AVATAR_LINES(); this.bubble(a, L2[Math.floor(Math.random() * L2.length)], 3.2); a.wave = 1.6; if (a.state === 'walk') { a.path = a.path.slice(0, 1); } a.face = { ...a.face, back: false }; this.render(a, 0); }
    else { if (a.state === 'rest') { a.state = 'idle'; a.t = 1.5; } heartAt(this.svg, isoX(a.x, a.y), isoY(a.x, a.y) - 24); this.render(a, 0); }
    if (this.still) return;
    this.kick();
  },
  /* the figures, standing still, for the picture to share */
  snapshot(rid) {
    const out = []; const mem = rid === this.rid && this.list.length ? null : this.mem[rid] || {};
    const figs = rid === this.rid && this.list.length ? this.list.map((a) => ({ id: a.id, kind: a.kind, x: a.x, y: a.y, face: a.face, rest: a.state === 'rest', it: a.it, pose: a.raster ? a.pose : null }))
      : [{ id: 'avatar', kind: 'avatar' }, ...Room.placedList(rid).filter((e) => e.it.walker).map((e) => ({ id: e.o.uid, kind: e.it.walker.kind, it: e.it, home: [e.x, e.y] }))].map((f) => {
        const m = mem[f.id]; const pos = m ? [m.x, m.y] : f.home ? [f.home[0] + 0.5, f.home[1] + 0.5] : [3.5, 4.5]; return { ...f, x: pos[0], y: pos[1], face: m?.face || { sx: 1 } };
      });
    for (const f of figs) {
      const still = { still: true, pose: f.pose && f.pose !== 'walk' ? f.pose : 'idle' };
      const inner = f.kind === 'avatar' ? (artAvatarSvg(avatarOf(), still) || avatarSvg(avatarOf(), { still: true })) : (artWalkerSvg(f.it, still) || walkerSvg(f.it.walker));
      let svg = inner.replace(/<g data-p="flip">/, `<g data-p="flip"${f.face?.sx < 0 ? ' transform="scale(-1,1)"' : ''}>`);
      if (f.rest) svg = svg.replace('<g data-pose="walk">', '<g data-pose="walk" display="none">').replace('<g data-pose="rest" display="none">', '<g data-pose="rest">');
      out.push({ id: f.id, actor: true, layer: 'solid', x: f.x - 0.22, y: f.y - 0.22, w: 0.44, d: 0.44, svg: `<g transform="translate(${f1(isoX(f.x, f.y))},${f1(isoY(f.x, f.y))})">${svg}</g>` });
    }
    return out;
  },
};

/* ---------- the character editor ---------- */
const AvatarEditor = {
  open() {
    const av = avatarOf(); let cur = { ...av };
    const prev = h('div', { class: 'av-prev' }); const body = h('div', { class: 'av-edit' });
    const art = artAvatarReady();
    const draw = () => {
      if (art) { prev.innerHTML = `<svg viewBox="-34 -76 68 82" class="av-svg">${artAvatarSvg(cur, { still: true, pose: 'idle' })}</svg><svg viewBox="-34 -76 68 82" class="av-svg">${artAvatarSvg(cur, { still: true, pose: 'xm' })}</svg>`; return; }
      prev.innerHTML = `<svg viewBox="-30 -66 60 72" class="av-svg"><ellipse cx="0" cy="-0.4" rx="14" ry="4" fill="#000" opacity=".25"/>${avatarSvg(cur, { still: true }).replace(/<ellipse[^>]*opacity="\.2"\/>/, '')}</svg><svg viewBox="-30 -66 60 72" class="av-svg"><g transform="scale(-1,1)">${avatarSvg(cur).replace('<g data-pose="front">', '<g data-pose="front" display="none">').replace('<g data-pose="back" display="none">', '<g data-pose="back">')}</g></svg>`;
    };
    const sw = (key, colors) => h('div', { class: 'av-sw' }, ...colors.map((c, i) => h('button', { type: 'button', class: 'sw' + ((key === 'skin' ? cur.skin === i : cur[key] === c) ? ' on' : ''), style: { background: c }, 'aria-label': c, onClick: () => { cur[key] = key === 'skin' ? i : c; render(); } })));
    const opts = (key, list) => h('div', { class: 'av-opts' }, ...list.map(([id, label, ach]) => {
      const locked = ach && !(state.settings.achievements || {})[ach]; const a = ach ? ACHIEVEMENTS.find((x) => x.id === ach) : null;
      return h('button', { type: 'button', class: 'chip' + (cur[key] === id ? ' on' : '') + (locked ? ' locked' : ''), style: { '--c': '#6e8ef0', '--ink': '#fff' }, title: locked && a ? `Earned with “${a.name}” — ${a.desc}` : '', onClick: () => { if (locked) { toast(a ? `Earned with the achievement “${a.name}”: ${a.desc}` : 'Earned with an achievement'); return; } cur[key] = id; render(); } }, locked ? '🔒 ' : '', label);
    }));
    const name = h('input', { type: 'text', maxlength: 16, placeholder: 'Name (optional)', value: cur.name || '' }); name.addEventListener('input', () => { cur.name = name.value.trim(); });
    const row = (label, ...kids) => h('div', { class: 'av-row' }, h('span', { class: 'av-lab muted small' }, label), h('div', { class: 'av-ctl' }, ...kids));
    if (art && !cur.look) cur.look = avLookOf(cur);
    const render = () => {
      draw();
      if (art) {
        setKids(body,
          row('Look', opts('look', AV_LOOKS)),
          row('Skin', sw('skin', AV_SKINS)),
          row('Hair', sw('hairC', AV_HAIR_C)),
          row('Top', sw('topC', AV_CLOTH_C)),
          row('Bottom', sw('bottomC', AV_CLOTH_C)),
          row('Hat', opts('hat', AV_HATS)),
          row('Name', name));
        return;
      }
      setKids(body,
        row('Skin', sw('skin', AV_SKINS)),
        row('Hair', opts('hair', AV_HAIR), sw('hairC', AV_HAIR_C)),
        row('Face', opts('face', AV_FACE)),
        row('Glasses', opts('glasses', AV_GLASSES)),
        row('Top', opts('top', AV_TOPS), sw('topC', AV_CLOTH_C)),
        row('Bottom', opts('bottom', AV_BOTTOMS), sw('bottomC', AV_CLOTH_C)),
        row('Shoes', sw('shoes', ['#eeeae2', '#2b2b30', '#b5483f', '#3f6ea8', '#8a5a36', '#e8b93c', '#6cbf63', '#e87aa8'])),
        row('Hat', opts('hat', AV_HATS)),
        row('Name', name));
    };
    const random = () => { const pick = (l) => l[Math.floor(Math.random() * l.length)]; cur = { ...cur, skin: Math.floor(Math.random() * AV_SKINS.length), hair: pick(AV_HAIR)[0], hairC: pick(AV_HAIR_C), top: pick(AV_TOPS)[0], topC: pick(AV_CLOTH_C), bottom: pick(AV_BOTTOMS)[0], bottomC: pick(AV_CLOTH_C), shoes: pick(['#eeeae2', '#2b2b30', '#b5483f', '#3f6ea8']), face: Math.random() < 0.7 ? 'none' : pick(AV_FACE)[0], glasses: Math.random() < 0.7 ? 'none' : pick(AV_GLASSES)[0], hat: Math.random() < 0.6 ? 'none' : pick(AV_HATS.filter((x) => hatUnlocked(x[0])))[0] }; if (art) cur.look = pick(AV_LOOKS)[0]; render(); };
    const save = () => { state.room.avatar = { ...cur, at: Room.touch() }; commit('room'); m.close(); toast('Looking good!'); Actors.list.forEach((a) => { if (a.id === 'avatar') { a.dirty = true; } }); RoomView.paint(); };
    const m = openModal({ title: 'Your character', cls: 'av-modal', body: h('div', { class: 'av-wrap' }, prev, body),
      footer: frag(h('button', { class: 'btn', onClick: random }, '🎲 Surprise me'), h('span', { class: 'grow' }), h('button', { class: 'btn', onClick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onClick: save }, 'Save')) });
    render();
  },
};
