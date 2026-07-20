// Скрытый каталог VIP-курса «Целостность». 34 медитации.
// Файл грузится динамически только после ввода VIP-пароля.
// Имя = celo-<первые16 hex ОТ sha256(пароль + соль)>.js — из хэша в data.js имя не вычислить.
// В data.js / app.js этот курс НЕ упоминается: покупатели 490/1490 его не видят.
const CELO_BASE = 'https://github.com/alenavesta/alenavesta.github.io/releases/download/celo-v1/';
window.VIP_SECTION = { title: 'Целостность' };
window.VIP_TRACKS = {
  celo_01: { id: 'celo_01', title: 'Предисловие', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-74f83781a4fe.m4a' },
  celo_02: { id: 'celo_02', title: '#1 · Целостность 3.0', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-a079d9d3e0f8.m4a' },
  celo_03: { id: 'celo_03', title: '#3 · Целостность 3.0', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-55aabd71e8fc.m4a' },
  celo_04: { id: 'celo_04', title: '#4 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-f713ac84de2b.m4a' },
  celo_05: { id: 'celo_05', title: '#6 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-183214d01dc9.m4a' },
  celo_06: { id: 'celo_06', title: '#7 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-6051e5a09971.m4a' },
  celo_07: { id: 'celo_07', title: '#8 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-e44fb56e143f.m4a' },
  celo_08: { id: 'celo_08', title: '#8 · Целостность (бонус)', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-86ad7b9916b3.m4a' },
  celo_09: { id: 'celo_09', title: '#9 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-3062a961d2a9.m4a' },
  celo_10: { id: 'celo_10', title: '#10 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-aea1cf0105e3.m4a' },
  celo_11: { id: 'celo_11', title: '#10 · Целостность 3.0', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-034570c16e01.m4a' },
  celo_12: { id: 'celo_12', title: '#11 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-7e9efcddabff.m4a' },
  celo_13: { id: 'celo_13', title: '#13 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-7318393f1326.m4a' },
  celo_14: { id: 'celo_14', title: '#14 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-3751b07e11ec.m4a' },
  celo_15: { id: 'celo_15', title: '#15 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-4eac8d5a1997.m4a' },
  celo_16: { id: 'celo_16', title: '#16 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-012dc1c14d76.m4a' },
  celo_17: { id: 'celo_17', title: '#17 · Целостность 2.0', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-f3a191c4b30d.m4a' },
  celo_18: { id: 'celo_18', title: '#18 · Целостность 2.0', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-4a2844299de9.m4a' },
  celo_19: { id: 'celo_19', title: '#19 · Страх', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-32fa3b9ed97a.m4a' },
  celo_20: { id: 'celo_20', title: '#20 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-65bf3ec51e07.m4a' },
  celo_21: { id: 'celo_21', title: '#21 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-128b9f66a2c4.m4a' },
  celo_22: { id: 'celo_22', title: '#22 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-06b8c918ead3.m4a' },
  celo_23: { id: 'celo_23', title: '#23 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-fd90f3a075e8.m4a' },
  celo_24: { id: 'celo_24', title: '#23 · Целостность 3.0', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-bdfd0dc6a3fc.m4a' },
  celo_25: { id: 'celo_25', title: '#24 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-7b1d487c2c8b.m4a' },
  celo_26: { id: 'celo_26', title: '#26 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-bd267ec7db01.m4a' },
  celo_27: { id: 'celo_27', title: '#27 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-ce51e5aa1b2a.m4a' },
  celo_28: { id: 'celo_28', title: '#28 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-defa60e5b9ec.m4a' },
  celo_29: { id: 'celo_29', title: '#29 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-cba596aa46bd.m4a' },
  celo_30: { id: 'celo_30', title: '#29 · Целостность 3.0', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-71a7926f8c1f.m4a' },
  celo_31: { id: 'celo_31', title: '#30 · Целостность', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-c0f57c3a3e0d.m4a' },
  celo_32: { id: 'celo_32', title: 'Бонус · Сила и уверенность в себе', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-b8e830a57de3.m4a' },
  celo_33: { id: 'celo_33', title: 'Бонус · Маха Мантра', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-554ec2531e44.m4a' },
  celo_34: { id: 'celo_34', title: 'Бонус · Денежный поток', type: 'медитация', category: 'celostnost', media: 'audio', stream: true, duration: '', about: 'Медитация из курса «Целостность».', file: CELO_BASE + 'celo-d022ec63b32c.m4a' },
};
