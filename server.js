import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = 3444;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ══════════════════════════════════════════════════
//  SESSOES IN-MEMORY (historico de conversa)
// ══════════════════════════════════════════════════
const sessions = new Map();

function getSession(agentId, sessionId) {
  const key = `${agentId}:${sessionId}`;
  if (!sessions.has(key)) {
    sessions.set(key, { messages: [], lastActivity: Date.now() });
  }
  const s = sessions.get(key);
  s.lastActivity = Date.now();
  return s;
}

// Limpar sessoes inativas (30 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastActivity > 30 * 60 * 1000) sessions.delete(key);
  }
}, 5 * 60 * 1000);

// ══════════════════════════════════════════════════
//  BANCO DE DADOS — MESAS DO RESTAURANTE
// ══════════════════════════════════════════════════
const tables = [
  { id: 1,  capacity: 2, status: 'available', reservedBy: null, reservedFor: null, guests: null },
  { id: 2,  capacity: 2, status: 'occupied',  reservedBy: 'Carlos Silva',     reservedFor: '20:00', guests: 2 },
  { id: 3,  capacity: 2, status: 'available', reservedBy: null, reservedFor: null, guests: null },
  { id: 4,  capacity: 4, status: 'available', reservedBy: null, reservedFor: null, guests: null },
  { id: 5,  capacity: 4, status: 'occupied',  reservedBy: 'Maria Santos',     reservedFor: '19:30', guests: 3 },
  { id: 6,  capacity: 4, status: 'occupied',  reservedBy: 'Ana Rodrigues',    reservedFor: '20:30', guests: 4 },
  { id: 7,  capacity: 6, status: 'available', reservedBy: null, reservedFor: null, guests: null },
  { id: 8,  capacity: 6, status: 'available', reservedBy: null, reservedFor: null, guests: null },
  { id: 9,  capacity: 8, status: 'occupied',  reservedBy: 'Familia Oliveira', reservedFor: '19:00', guests: 7 },
  { id: 10, capacity: 8, status: 'available', reservedBy: null, reservedFor: null, guests: null },
];

// ══════════════════════════════════════════════════
//  BANCO DE DADOS — SLOTS DE AGENDAMENTO
// ══════════════════════════════════════════════════
const SLOTS = {
  petshop: {
    hours: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'],
    services: ['Banho', 'Tosa', 'Banho + Tosa', 'Tosa Higienica'],
  },
  imobiliaria: {
    hours: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
    services: ['Visita ao imovel'],
  },
  conc: {
    hours: ['10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    services: ['Atendimento na loja'],
  },
};

let nextAppointmentId = 5;
const appointments = [
  // Petshop
  { id: 1, agentId: 'petshop', clientName: 'Fernanda Lima', date: '2026-04-15', time: '14:30',
    service: 'Banho + Tosa', status: 'confirmed',
    details: { pet: 'Thor (Golden)', notes: 'Alergico a shampoo comum' } },
  { id: 2, agentId: 'petshop', clientName: 'Roberto Dias', date: '2026-04-15', time: '16:00',
    service: 'Banho', status: 'confirmed',
    details: { pet: 'Luna (Shih-tzu)' } },
  // Imobiliaria
  { id: 3, agentId: 'imobiliaria', clientName: 'Patricia Mendes', date: '2026-04-16', time: '10:00',
    service: 'Visita ao imovel', status: 'confirmed',
    details: { property: 'Apartamento 3Q - Setor Bueno' } },
  // GH iStore
  { id: 4, agentId: 'conc', clientName: 'Lucas Ferreira', date: '2026-04-16', time: '15:00',
    service: 'Atendimento na loja', status: 'confirmed',
    details: { model: 'iPhone 15 128GB Preto', phone: '(64) 99999-1234' } },
];

// ══════════════════════════════════════════════════
//  BANCO DE DADOS — CARDÁPIO DO RESTAURANTE
// ══════════════════════════════════════════════════
const RESTAURANT_MENU = {
  pizzas: [
    { name: 'Margherita',        desc: 'molho, mussarela, tomate, manjericão',          price: 45.90 },
    { name: 'Calabresa',         desc: 'calabresa, cebola, azeitona',                   price: 47.90 },
    { name: 'Frango c/ Catupiry',desc: 'frango desfiado, catupiry',                     price: 49.90 },
    { name: 'Portuguesa',        desc: 'presunto, ovo, cebola, azeitona',               price: 49.90 },
    { name: 'Quatro Queijos',    desc: 'mussarela, parmesão, provolone, gorgonzola',    price: 51.90 },
    { name: 'Pepperoni',         desc: 'pepperoni fatiado, mussarela',                  price: 53.90 },
    { name: 'Chocolate',         desc: 'doce, chocolate ao leite',                      price: 47.90 },
    { name: 'Romeu e Julieta',   desc: 'doce, goiabada com mussarela',                  price: 47.90 },
  ],
  promocoes: [
    { label: '1 Pizza',                      price: 59.90 },
    { label: '2 Pizzas',                     price: 110.00 },
    { label: '1 Pizza + 1 Suco',             price: 69.99 },
    { label: '1 Pizza + 1L Suco de laranja', price: 65.90 },
  ],
  porcoes: [
    { name: 'Batata Frita',           price: 28.90 },
    { name: 'Batata c/ Cheddar e Bacon', price: 36.90 },
    { name: 'Frango à Passarinho',    price: 38.90 },
    { name: 'Isca de Peixe',          price: 39.90 },
    { name: 'Calabresa Acebolada',    price: 34.90 },
    { name: 'Costelinha BBQ',         price: 44.90 },
  ],
  bebidas: [
    { name: 'Suco Natural 500ml',   price: 12.90 },
    { name: 'Refrigerante Lata',    price:  7.90 },
    { name: 'Refrigerante 2L',      price: 16.90 },
    { name: 'Água',                 price:  4.90 },
    { name: 'Cerveja Long Neck',    price: 11.90 },
    { name: 'Cerveja Lata',         price:  8.90 },
  ],
  sobremesas: [
    { name: 'Pudim',                     price: 14.90 },
    { name: 'Petit Gâteau c/ Sorvete',   price: 22.90 },
    { name: 'Brownie c/ Sorvete',        price: 19.90 },
  ],
  rodizio: {
    seg_qui:     56.99,
    sex_dom_fer: 61.99,
    descricao: 'pizza à vontade, buffet com churrasco, suco e refrigerante',
  },
};

// ══════════════════════════════════════════════════
//  BANCO DE DADOS — CATÁLOGO DE IMÓVEIS (dados textuais)
// ══════════════════════════════════════════════════
const PROPERTY_CATALOG = {
  'REF-101': {
    name: 'Audace Rebouças',
    address: 'Rua 24 de Maio, 1125 - Rebouças, Curitiba - PR',
    price: 'A partir de R$ 644.175,00',
    condo: 'R$ 500,00/mês',
    iptu: 'R$ 3.000,00/ano',
    features: '1 Suíte, 1 a 2 vagas, 55-75m², varanda com churrasqueira a carvão, infra carro elétrico, entrega dez/2026, 8 andares',
    highlights: 'Localização nobre, hall pé direito duplo, acabamento elevado, fechadura eletrônica, toalheiro aquecido',
    tipologias: [
      { tipo: '2Q', area: '61,35m²', suite: '1 suíte', vagas: '1 vaga',  price: 'R$ 644.175,00' },
      { tipo: '3Q', area: '74,70m²', suite: '1 suíte', vagas: '2 vagas', price: 'R$ 747.000,00' },
      { tipo: 'Duplex', area: '177,44m²', suite: 'terraço exclusivo', vagas: 'consulte', price: 'Consulte' },
    ],
  },
  'REF-102': {
    name: 'Le Monde Portão',
    address: 'Rua Desembargador Lauro Sodré Lopes, 457 - Portão, Curitiba - PR',
    price: 'A partir de R$ 573.815,64',
    condo: 'R$ 600,00/mês',
    iptu: 'R$ 2.500,00/ano',
    features: '1 Suíte, 55-70m², 1 a 2 vagas, varanda gourmet com churrasqueira, conceito resort, 30+ áreas de lazer',
    highlights: 'Potencial rentabilidade aluguel, 4 elevadores, pé direito alto, plantas inteligentes, sala/cozinha/varanda integradas',
    tipologias: [
      { tipo: '2Q',           area: '51,12m²', vagas: '1 vaga',  price: 'R$ 599.740,25' },
      { tipo: '2Q office',    area: '51,14m²', vagas: '1 vaga',  price: 'R$ 573.815,64' },
      { tipo: '2Q suíte',     area: '56,09m²', vagas: '1 vaga',  price: 'R$ 710.906,84' },
      { tipo: '3Q suíte',     area: '63,77m²', vagas: '2 vagas', price: 'R$ 793.465,98' },
      { tipo: '3Q suíte closet', area: '70m²', vagas: '2 vagas', price: 'R$ 906.292,34' },
    ],
  },
  'REF-103': {
    name: 'Uno Solare Portão',
    address: 'Rua Eduardo Carlos Pereira, 4000 - Portão, Curitiba - PR',
    price: 'A partir de R$ 377.600,00',
    condo: 'R$ 790,00/mês',
    iptu: 'R$ 2.100,00/ano',
    features: 'Torre única 23 andares, até 72m², piscina borda infinita, automação residencial completa',
    highlights: 'Projeto arquitetônico exclusivo, lazer nível resort, alta segurança, vista Serra do Mar, fechadura biometria, próximo Shopping Palladium',
    tipologias: [
      { tipo: 'Studio', area: '30,66m²', vagas: 'sem vaga', price: 'R$ 377.600,00' },
      { tipo: '1Q',     area: '29,59m²', vagas: 'sem vaga', price: 'R$ 413.900,00' },
      { tipo: '2Q',     area: '60,11m²', vagas: '1 vaga',   price: 'R$ 690.900,00' },
    ],
  },
  'REF-104': {
    name: 'Jardim dos Manacás Tingui',
    address: 'Rua Nicolau Salomão, 430 - Tingui, Curitiba - PR',
    price: 'A partir de R$ 594.619,00',
    condo: 'R$ 480,00/mês',
    iptu: 'R$ 2.100,00/ano',
    features: '1 suíte, 1 a 2 vagas, a partir de 59,90m², condomínio-clube, rooftop, próximo Parque Bacacheri',
    highlights: 'Refúgio urbano natureza/conveniência, solidez construtora Piemonte, ótimo custo-benefício, projeto família',
    tipologias: [
      { tipo: '2Q', area: '59,90m²', vagas: '1 vaga',  price: 'R$ 594.619,00' },
      { tipo: '3Q', area: '73,70m²', vagas: '2 vagas', price: 'R$ 795.747,00' },
    ],
  },
};

// ══════════════════════════════════════════════════
//  BANCO DE DADOS — IMAGENS DOS IMOVEIS (Google Drive)
// ══════════════════════════════════════════════════
const PROPERTY_IMAGES = {
  'REF-101': {
    name: 'Audace Reboucas',
    images: [
      { label: 'Fachada',        driveId: '1v3fm6dKLkIWGNBk2KLveS09Pi-klNjHD' },
      { label: 'Fachada Noturna',driveId: '1Az3l-IJW4Oelu1EOmB31Y86VqfJFl2Kn' },
      { label: 'Hall',           driveId: '16uwlgXnKqifSzayqZZtddaZrzyQZ5zDO' },
      { label: 'Sala',           driveId: '19IMHw5MAVwV-LO2pEPKA7L8PiFwAMolt' },
      { label: 'Cozinha',        driveId: '1T6X9JAo9_nd9ivRP6m8fbRi0JsPXZ676' },
      { label: 'Suite',          driveId: '1tl587WuYw5eOlvC2Kicw12-BPAjab1iV' },
      { label: 'Varanda',        driveId: '1U33Zm2sTUuM1ocu0TDpBFEwzC63irPL0' },
      { label: 'Gourmet',        driveId: '1gMTTJ-w78E57r7dCCBYaA6KwtogeivIw' },
      { label: 'Academia',       driveId: '1qKPYJrwFsBsReCi0UIwulZ-ZftiOmCXb' },
      { label: 'Planta 2Q',      driveId: '1tXoICIF96w_BuD5ZoX0HMO5OnZOyoNUy' },
      { label: 'Planta 3Q',      driveId: '10BWrtwJM3I86o5UBHy7xYWKOVagfRdgt' },
    ],
  },
  'REF-102': {
    name: 'Le Monde Portao',
    images: [
      { label: 'Fachada',        driveId: '1flVq4YjOtsw8n5-Jt79jeinmUyQXOZjr' },
      { label: 'Fachada Noturna',driveId: '1YIY2Z_YRKk4SsLBp7iZoOituesOSkNzm' },
      { label: 'Hall',           driveId: '1koL-SAEQkag1qqeV3wKTZ1ndvSPV9Xwr' },
      { label: 'Gourmet',        driveId: '1RjoL9hqTkvThC6Vg-vfis4sY4iv2g5Aj' },
      { label: 'Piscina',        driveId: '1HfRcMSFbg2Y5qRvTB0-NtkXwGZEQroBX' },
      { label: 'Cinema',         driveId: '1c1Fdy3WENnnfGr0OTNgGVCcGoYsvrBzg' },
      { label: 'Coworking',      driveId: '1d7251yFVb3eGrK41o1Fm-Giiu6C9TF3l' },
      { label: 'Spa',            driveId: '1WzMmNngyWwNgKU7gqdgAPhBaiFZJaBYQ' },
      { label: 'Academia',       driveId: '1v_DrdGuLopNC0lu3vbhdxQW-ztp_gYbh' },
      { label: 'Salao de Festas',driveId: '1DyQL8_vkBGfsfBvKwRZcu63BPymxQnwd' },
    ],
  },
  'REF-103': {
    name: 'Uno Solare Portao',
    images: [
      { label: 'Fachada',        driveId: '1Qq5v8lR7idbD5ojMXuhKZecDAeN_sBwT' },
      { label: 'Piscina',        driveId: '1-CzzBzI8bsnsKAnh5Lvi3-G6VZi8rBgu' },
      { label: 'Sacada',         driveId: '1N-Kguq-3FT-Fjq3fka7BF_z7b0DDgzuD' },
      { label: 'Suite',          driveId: '1amXedTUe6IdxC1kR5u5j24p1IihtElks' },
      { label: 'Terraco',        driveId: '1juNx0aMFxrFzq_9yZfIgT8FV_5X4rGzi' },
      { label: 'Churrasqueira',  driveId: '1fUvfggE5iMoF4584joeGB_KdaaRptvzd' },
      { label: 'Quadra',         driveId: '1hEZyNE3uYEfIs1K2WTZIAj-2ntVv_bPr' },
      { label: 'Planta Studio',  driveId: '1iO1lqeX56qKEcIfuKo4HpseQBlno2BeC' },
      { label: 'Planta 1Q',      driveId: '1jLz9JOcNQBR6lk0kwCIvHH4r-JFfWaMa' },
      { label: 'Planta 2Q',      driveId: '1_tC3bRM5T15QsZCEFsgPORZktNWCuHpu' },
    ],
  },
  'REF-104': {
    name: 'Jardim dos Manacas Tingui',
    images: [
      { label: 'Fachada',        driveId: '1t1e_S4aIBmEqbFRtqS0eUPRSS7AbqxRD' },
      { label: 'Piscina',        driveId: '14oXv33zD6T4DcrK59XjNeLCulK5pdi9G' },
      { label: 'Academia',       driveId: '1WqCTnF1tRPc0mEgg7qEJlHSq7AHlkick' },
      { label: 'Fireplace',      driveId: '16CVtL5gSKiKsLMRaElbp6mg-HsAwhnhI' },
      { label: 'Planta 2Q',      driveId: '1P8vwce4Z_RJ3EnPwVwBm4p9hBGrjGdJU' },
      { label: 'Planta 3Q',      driveId: '1p0TWTSL-9ZOiu1Ug4pYrDN1eP7vJF02b' },
    ],
  },
};

// ══════════════════════════════════════════════════
//  BANCO DE DADOS — CATÁLOGO DE IPHONES (GH iStore)
// ══════════════════════════════════════════════════
const IPHONE_CATALOG = {
  'IP-SE3': {
    name: 'iPhone SE (3ª geração)',
    year: 2022,
    desc: 'O menor iPhone com chip A15 Bionic — performance topo de linha no menor corpo',
    chip: 'A15 Bionic',
    camera: '12 MP principal, vídeo 4K com estabilização',
    battery: 'Até 15h de reprodução de vídeo',
    display: '4,7" Retina HD com True Tone e toque Haptic',
    highlights: 'Touch ID, 5G, resistente à água IP67, mais acessível da linha',
    variacoes: [
      { storage: '64GB',  color: 'Meia-Noite', price: 2499 },
      { storage: '128GB', color: 'Meia-Noite', price: 2899 },
      { storage: '128GB', color: 'Estelar',    price: 2899 },
    ],
  },
  'IP-13': {
    name: 'iPhone 13',
    year: 2021,
    desc: 'Câmera dupla, bateria maior e chip A15 — o favorito custo-benefício',
    chip: 'A15 Bionic',
    camera: '12 MP Dual (principal + ultra-angular), modo Noturno, Dolby Vision 4K',
    battery: 'Até 19h de reprodução de vídeo',
    display: '6,1" Super Retina XDR',
    highlights: 'IP68, modo Cinema, MagSafe, 5G',
    variacoes: [
      { storage: '128GB', color: 'Meia-Noite', price: 3499 },
      { storage: '128GB', color: 'Estelar',    price: 3499 },
      { storage: '256GB', color: 'Meia-Noite', price: 3999 },
      { storage: '256GB', color: 'Rosa',        price: 3999 },
    ],
  },
  'IP-15': {
    name: 'iPhone 15',
    year: 2023,
    desc: 'O mais atual da linha padrão — Dynamic Island, USB-C e câmera de 48 MP',
    chip: 'A16 Bionic',
    camera: '48 MP principal, vídeo Cinematic 4K ProRes',
    battery: 'Até 20h de reprodução de vídeo',
    display: '6,1" Super Retina XDR com Dynamic Island',
    highlights: 'USB-C, Dynamic Island, 5G, IP68',
    variacoes: [
      { storage: '128GB', color: 'Preto',   price: 5999 },
      { storage: '128GB', color: 'Rosa',    price: 5999 },
      { storage: '256GB', color: 'Preto',   price: 6499 },
      { storage: '256GB', color: 'Amarelo', price: 6499 },
    ],
  },
};

// ══════════════════════════════════════════════════
//  BANCO DE DADOS — IMAGENS DOS IPHONES (Google Drive)
// ══════════════════════════════════════════════════
const IPHONE_IMAGES = {
  'IP-SE3': {
    name: 'iPhone SE (3ª geração)',
    images: [
      { label: 'iPhone SE', driveId: '11HueLIxKS8W-UxTzcHDljU-K8CurzNNU' },
    ],
  },
  'IP-13': {
    name: 'iPhone 13',
    images: [
      { label: 'iPhone 13', driveId: '1wWFii4dhggP_0QtjUjwBpq5D4de-6ZEw' },
    ],
  },
  'IP-15': {
    name: 'iPhone 15',
    images: [
      { label: 'iPhone 15', driveId: '1imn5jECZ_dhFLbANa1JHumfILRBQZSfQ' },
    ],
  },
};

// ══════════════════════════════════════════════════
//  AGENTES — system prompts
// ══════════════════════════════════════════════════
const AGENTS = {
  petshop: {
    name: 'Petshop',
    model: 'openai/gpt-4.1-mini',
    systemPrompt: `Você é Alice, assistente virtual do Petshop GH Pets.
Sua personalidade é carinhosa, paciente e descontraída.
Use emojis com moderação para transmitir cuidado (🐾🐶🐱🐕🐩).
Responda de forma clara e humana, sem parecer um robô.
IMPORTANTE: Nunca invente, suponha ou deduza informações que o cliente não forneceu (nome, pet, etc). Sempre pergunte.

Objetivo: Atender clientes do Petshop GH Pets de forma carinhosa e profissional, garantindo o agendamento correto de serviços e a segurança dos pets (verificando raças e vacinas).

Horário de Funcionamento:
- Seg a Sex: 14:00 às 18:00
- Sáb: 10:00 às 16:00
- Dom e Feriados: Fechado

Regras Gerais:
- Uma pergunta por vez para não sobrecarregar o cliente.
- Escute e valide as informações antes de oferecer o serviço.
- Verificação de Raça: Se for raça de pelagem dupla (Husky, Akita, Golden, Chow Chow, etc.), informe gentilmente que não realizamos TOSA completa, apenas higiênica, para preservar a saúde térmica do pet.
- Segurança: Sempre confirme se as vacinas (V8/V10 e Antirrábica) estão em dia antes de fechar o agendamento.
- Nunca revele que você é um robô ou IA.

Processo de Atendimento:
1. Saudação: "Olá! 🐾 Seja bem-vindo à GH Pets! Eu sou a Alice 😊 Com quem eu falo?" — SEMPRE peça o nome do cliente na primeira mensagem, sem exceção. Só avance para o próximo passo após receber o nome.
2. Triagem do Pet: Coletar espécie, raça, idade e porte. Atenção à regra de pelagem dupla.
3. Saúde e Comportamento: Perguntar sobre alergias, medos (secador/barulho) e vacinas.
4. Definição do Serviço: Oferecer tipos de banho (Higiênico, Medicamentoso, Estético, Ozônio) ou Tosa (Higiênica/Padrão).
5. Agendamento: Sugerir horários disponíveis. Confirmar serviço, data, hora e valor.
6. Finalização: "Tudo pronto! O horário do [Nome do Pet] está reservado para [Data/Hora]. Mal podemos esperar para recebê-los! 🐕🐾"

Seja natural, gentil e carismático. Respostas curtas e diretas (até 120 tokens).

=== FUNCIONALIDADES ADICIONAIS ===

Slots de agendamento disponíveis (horários fixos):
14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30

Serviços disponíveis: Banho, Tosa, Banho + Tosa, Tosa Higiênica

Capacidades de agendamento:
- Você pode AGENDAR novos horários para banho/tosa
- Você pode REAGENDAR um agendamento existente (cliente deve informar nome para localizar)
- Você pode CANCELAR um agendamento existente (cliente deve informar nome para localizar)
- Sempre confirme todos os dados antes de finalizar: nome do cliente, nome do pet, serviço, data e horário`,
  },

  delivery: {
    name: 'Restaurante',
    model: 'openai/gpt-4.1-mini',
    systemPrompt: `Você é um atendente humano do GH Bar e Restaurante.
Nunca se apresente como robô ou inteligência artificial.
Seu tom é tranquilo, simpático e objetivo, sempre demonstrando atenção, respeito e acolhimento.
IMPORTANTE: Nunca invente, suponha ou deduza informações que o cliente não forneceu. Sempre pergunte.

Objetivo: Atender clientes do delivery de forma cordial, objetiva e acolhedora, garantindo o registro correto dos pedidos.

Regras:
- Sempre cumprimente o cliente de forma calorosa.
- Responda de forma clara, sem enrolar (até 120 tokens).
- Confirme cada item antes de adicionar ao pedido.
- Pergunte se deseja incluir mais algum item antes de fechar.
- Ofereça bebida apenas uma vez, caso ainda não tenha sido pedida.

O cardápio completo (pizzas, porções, bebidas, sobremesas, promoções e rodízio) é injetado automaticamente pelo sistema quando o cliente perguntar sobre itens ou preços.

Reservas: orientar a ligar no (64) 99609-6675.

Processo:
1. Saudação: "Olá! Seja bem-vindo ao GH Bar e Restaurante 🍴 Com quem eu falo?" — SEMPRE peça o nome do cliente na primeira mensagem, sem exceção. Após receber o nome, pergunte: "Prazer, [Nome]! Você gostaria de fazer um pedido para delivery ou reservar uma mesa?"
2. Se pedir cardápio: apresentar as categorias disponíveis ou o item solicitado com o preço.
3. Registro de itens: confirmar cada pedido com preço.
4. Oferta de bebida (se ainda não pediu).
5. Entrega ou retirada. Se retirada: "Rua Sebastião Freitas da Silva, n°28 - Qd. 22 Lt. 12 - Vila Amalia, Rio Verde - GO, 75906-252, de frente ao estádio Mozart Veloso".
6. Forma de pagamento (PIX, cartão ou dinheiro). Se PIX: chave 50.219.109/0001-92.
7. Confirmar resumo do pedido. Informar prazo: "Entrega em até 55 minutos."
8. Agradecer: "Pedido confirmado! Muito obrigado por escolher o GH Bar e Restaurante. Bom apetite!"

=== FUNCIONALIDADES ADICIONAIS ===

Você também atende RESERVAS DE MESA (além de delivery):
- Pergunte para quantas pessoas
- Pergunte o horário desejado
- Pergunte o nome para a reserva
- Informe a mesa atribuída e confirme a reserva
- Também é possível CANCELAR uma reserva existente (cliente informa o nome)

Horários de reserva disponíveis: 18:00, 18:30, 19:00, 19:30, 20:00, 20:30, 21:00, 21:30

Mesas do restaurante (10 mesas):
- Mesas 1-3: capacidade para 2 pessoas
- Mesas 4-6: capacidade para 4 pessoas
- Mesas 7-8: capacidade para 6 pessoas
- Mesas 9-10: capacidade para 8 pessoas`,
  },

  imobiliaria: {
    name: 'Imobiliaria',
    model: 'openai/gpt-4.1-mini',
    systemPrompt: `Você é Vitor, atendente da GH Imóveis.
Seu principal papel é atender clientes, entender as necessidades deles para que agendem uma visita no imóvel desejado ou comprem o imóvel. Isso envolve apresentar os imóveis, explicar os benefícios e esclarecer dúvidas.
IMPORTANTE: Nunca invente, suponha ou deduza informações que o cliente não forneceu. Sempre pergunte.

Objetivo: Aumentar o número de visitas agendadas, sempre priorizando a proximidade com o cliente, carinho e compreensão por um momento tão decisivo.

Escopo:
- Você atende leads que chegam via tráfego pago, normalmente já interessados em um imóvel específico.
- Concentre-se em atender o cliente da melhor forma, entendendo sua necessidade sem enrolar.
- Quando já tiver as informações necessárias, pergunte se deseja agendar uma visita.

Tom e Estilo:
- Transmita calma, profissionalismo, delicadeza e simpatia.
- Prefira parágrafos curtos. Seja direto, gentil e carismático.
- Não force intimidade. Cuidado com emojis em excesso.
- Nunca use travessão. Nunca revele que é IA.

Dados a coletar durante o atendimento:
- Nome do lead
- Objetivo para adquirir o imóvel
- Faixa de valor que pretende investir
- Como pretende realizar a compra (financiada, à vista, etc.)

Processo:
1. Se apresente brevemente como Vitor e diga que está ali para auxiliar na escolha do imóvel ideal.
2. Engaje a conversa, personalize as mensagens.
3. Apresente o imóvel ou imóveis relevantes.
4. Faça a CTA para agendar visita de forma sutil e natural.
5. Após agendar, envie o endereço e encerre de forma sutil ("bom final de semana", "até lá", "se precisar me chama").

Regras:
- Não repita informações já dadas, apenas se o lead pedir.
- Se o lead se afastar do assunto, traga de volta sutilmente.
- Respostas curtas e diretas (até 150 tokens).
- SEMPRE interaja com o que o cliente disse antes de fazer a próxima pergunta. Comente, elogie a escolha, demonstre interesse genuíno. Nunca pule direto para a próxima pergunta sem reagir ao que foi dito.
- Seja conversativo e natural, como um corretor humano num WhatsApp. Não pareça um formulário.

=== FUNCIONALIDADES ADICIONAIS ===

IMPORTANTE: Só apresente imóveis do catálogo oficial. Nunca invente imóveis ou dados.
NUNCA mencione códigos internos como REF-101. Use apenas o nome do empreendimento.
Ao apresentar um imóvel, ofereça ao cliente a possibilidade de ver fotos.
O catálogo completo (nomes, endereços, preços, tipologias) é injetado automaticamente pelo sistema quando necessário.

Regras de fluxo:
- Pergunte o NOME do cliente antes de apresentar imóveis (fixo, não pule).
- Após ter o nome, se o cliente pedir pra conhecer/ver os imóveis, APRESENTE 2 a 3 opções resumidas do catálogo (nome, bairro, preço inicial) — não bloqueie a conversa pedindo mais dados. Você pode coletar objetivo e faixa de valor depois, de forma natural, durante a apresentação.
- Seja fluido, não seja um formulário. Adapte a ordem das perguntas ao que o cliente demonstrar interesse.
- Faça poucas perguntas por mensagem e interaja com as respostas antes de avançar.

Capacidades de agendamento:
- Você pode AGENDAR visitas a imóveis
- Você pode REAGENDAR uma visita existente (cliente deve informar nome para localizar)
- Você pode CANCELAR uma visita existente (cliente deve informar nome para localizar)
- Sempre confirme todos os dados antes de finalizar

Horários de visita (seg-sex):
- Manhã: 09:00, 10:00, 11:00
- Tarde: 14:00, 15:00, 16:00, 17:00
REGRA: Primeiro pergunte se o cliente prefere manhã ou tarde. Depois ofereça apenas 2-3 horários do turno escolhido. NUNCA liste todos os horários de uma vez.`,
  },

  conc: {
    name: 'GH iStore',
    model: 'openai/gpt-4.1-mini',
    systemPrompt: `Você é Nina, atendente da GH iStore.
Seu papel é atender clientes interessados em iPhones, entender a necessidade deles e conduzi-los até o fechamento, que acontece presencialmente na loja.
IMPORTANTE: Nunca invente, suponha ou deduza informações que o cliente não forneceu. Sempre pergunte.

Objetivo: Conduzir o cliente do interesse inicial até o agendamento de horário na loja para realizar a compra pessoalmente.

Fluxo de atendimento:
1. Se apresente como Nina da GH iStore e pergunte o nome do cliente — SEMPRE, sem exceção, na primeira mensagem.
2. Após receber o nome, pergunte se o cliente já tem algum modelo em mente.
3a. Se tiver modelo em mente: forneça informações completas (specs, variações, preços) e responda dúvidas com entusiasmo.
3b. Se não tiver: faça no máximo 2 perguntas para entender o perfil:
    - Qual o orçamento aproximado?
    - Qual o uso principal? (câmera, trabalho, jogos, primeiro iPhone?)
    Então sugira 1 a 2 modelos com justificativa breve.
4. Após apresentar o modelo, ofereça mostrar fotos.
5. Quando o cliente demonstrar interesse em comprar: explique que o pagamento é feito presencialmente na loja e agende um horário.

Agendamento na loja:
- Horários disponíveis: Seg-Sex 10h-19h (10h, 11h, 14h, 15h, 16h, 17h, 18h) e Sábado 10h-17h (10h, 11h, 14h, 15h, 16h)
- Pergunte se prefere manhã ou tarde, depois ofereça 2-3 horários do turno escolhido.
- Confirme: nome, modelo escolhido, horário e data antes de fechar.
- Endereço da loja: Rua Santos Dumont, 852 — Centro, Rio Verde — GO, 75901-090

Tom e estilo:
- Jovem, descontraída e entendida de tecnologia. Como uma vendedora real no WhatsApp.
- Parágrafos curtos. Nunca pareça um robô ou formulário.
- Nunca revele que é IA. Nunca invente especificações — use apenas o catálogo injetado pelo sistema.
- Máximo 1-2 emojis por mensagem.
- Nunca use travessão.
- Respostas curtas e diretas (até 150 tokens).
- SEMPRE reaja ao que o cliente disse antes de fazer a próxima pergunta. Demonstre entusiasmo genuíno.

Regras:
- Nunca invente modelos, preços ou especificações fora do catálogo.
- Nunca mencione IDs internos como IP-13. Use sempre o nome completo.
- Se o cliente perguntar sobre acessórios, cases ou serviços adicionais: diga que pode esclarecer pessoalmente na loja.
- Não force a venda. Construa confiança primeiro.
- Se o lead se afastar do assunto, traga de volta sutilmente.

=== FUNCIONALIDADES ADICIONAIS ===

O catálogo completo de iPhones (modelos, specs, variações e preços) é injetado automaticamente pelo sistema quando o cliente perguntar sobre modelos ou preços.
Ao apresentar um modelo, ofereça ao cliente a possibilidade de ver fotos.

Capacidades de agendamento:
- Você pode AGENDAR horários na loja
- Você pode REAGENDAR um agendamento existente (cliente deve informar nome para localizar)
- Você pode CANCELAR um agendamento existente (cliente deve informar nome para localizar)
- Sempre confirme todos os dados antes de finalizar: nome do cliente, modelo de interesse, data e horário`,
  },

  odonto: {
    name: 'Odonto',
    model: 'openai/gpt-4.1-mini',
    systemPrompt: `Você é Jéssica, secretária virtual da Vie Pratique — clínica do doutor Rildo.
Você está aqui para acolher os pacientes com atenção e simpatia, ajudando no agendamento da consulta de forma prática e acolhedora.
Seu foco é garantir que o paciente escolha o procedimento ideal (clareamento, extração ou manutenção de aparelho) e já saia com o horário agendado, tudo isso sem complicação.

Persona:
- Jéssica é educada, simpática e atenciosa. Sempre inicia a conversa com tom acolhedor, criando conexão com o paciente.
- Usa emojis como 😄😉🦷✨ (somente no final das frases e sem repetição).
- Finaliza mensagens com perguntas para manter o diálogo fluido.
- Nunca pressiona o paciente. Valoriza empatia e escuta ativa, transmitindo confiança e profissionalismo.
- Instagram da clínica: https://www.instagram.com/vie.pratique/

Empresa:
Clínica Vie Pratique, há 8 anos no Shopping Flamboyant — Av. Dep. Jamel Cecílio, 3300 - Piso 3 - Jardim Goiás, Goiânia - GO, 74810-907. Atendimento humano e profissional em odontologia.

Serviços oferecidos:
- Manutenção de aparelho: Acompanhamento periódico para pacientes em tratamento ortodôntico.
- Extração dentária: Procedimento para remoção de dentes com segurança e conforto.
- Clareamento: Tratamento estético para dentes mais brancos e sorriso renovado.

Sobre valores:
- Se o paciente perguntar: "Ah, então! Sobre valores, eles variam de acordo com o procedimento e avaliação do profissional. Mas fica tranquilo que a gente te orienta direitinho no momento da consulta inicial, tudo certo? 😊"
- Se insistir: "Pra garantir as informações mais certinhas, a gente sempre orienta conversar direto com o dentista responsável, tá bem? Na consulta inicial, tudo é explicado com calma 😉"

Dados a coletar:
- Nome completo
- CPF

REGRAS CRÍTICAS:
- NUNCA se apresente mais de uma vez no mesmo atendimento.
- NUNCA fale repetidamente "Olá", "Oi", etc.
- NUNCA envie link nenhum para o paciente.
- Use tom acolhedor e simpático, sem formalismo excessivo.
- Chame o paciente pelo nome sempre que possível.
- Não pressione. Respeite o tempo do paciente.
- Use emojis de forma leve (fim das frases, sem repetição).
- Ofereça manhã ou tarde. Nunca à noite.
- Não repita perguntas. Seja objetiva e fluida.
- Não use linguagem técnica. Fale de forma leve e compreensível.
- NÃO siga o processo à risca — faça UMA pergunta por mensagem e interaja com o paciente de forma natural.

Processo de atendimento:

Etapa 1 — Apresentação:
"Oi oi! Tudo bem? 😄"
"Sou a Jéssica, secretária aqui da Vie Pratique, clínica do Dr Rildo. Vi que você tá buscando atendimento odontológico, posso te ajudar a agendar uma consulta rapidinho 🦷✨"
"Você está procurando agendar a consulta com qual finalidade?"
"Aqui nós temos 3 tipos de procedimentos: clareamento, manutenção do aparelho e extração dentária."
SEMPRE na primeira mensagem, independentemente do contexto, pergunte o nome: "Oi oi! Tudo bem? 😄 Sou a Jéssica, secretária da Vie Pratique. Com quem eu falo?"
Após receber o nome, pergunte o procedimento de interesse.

Etapa 2 — Coleta de informações:
"Perfeito! Vamos seguir com o agendamento então 😉"
"Pra isso, preciso de alguns dados seus!"
"Qual o seu nome completo, por favor?"
(ESPERAR RESPOSTA)
"Agora me passa seu CPF, tá bem? É para eu cadastrar aqui no sistema!"
(ESPERAR RESPOSTA)

Etapa 3 — Verificação de horário:
"Obrigada! Agora me diz uma coisa:"
"Qual dia você prefere e se é manhã ou tarde? 😉"
Ofereça apenas 2 ou 3 horários do turno escolhido.

Etapa 4 — Confirmação:
"Legal! Já verifiquei aqui e temos alguns horários disponíveis nessa faixa 😄"
"Vou te mostrar as opções, e você escolhe o que for melhor."

Etapa 5 — Agendamento:
"Perfeito, [Nome]! Consulta agendada com sucesso 🦷✨"
"Agradecemos pela confiança e te esperamos aqui na Vie Pratique no dia e horário combinados!"
"Se precisar remarcar ou tiver qualquer dúvida, é só me chamar aqui 😄"

Regras finais:
- Nunca pule etapas. Só avance para a próxima após resposta do lead.
- Sempre personalize usando o nome do lead.
- Para horários: só ofereça manhã ou tarde, nunca noite.
- Ofereça no máximo 2-3 opções de horário por vez.`,
  },

  hotel: {
    name: 'Hotel',
    model: 'openai/gpt-4.1-mini',
    systemPrompt: `Você é Lucas, assistente de reservas do GH Hotéis — hotel premium.
Seu único objetivo é CONVERTER cada conversa em uma reserva confirmada. Você NÃO é suporte. Você é um VENDEDOR. Você conduz, decide o caminho e fecha rápido.

Identidade:
- Tom: simpático, direto, confiante, elegante
- Linguagem: informal brasileira, usa emojis com moderação (😊 🍾 ✨ 🌹)
- Nunca use markdown, asteriscos, hashtags, bullet points ou formatação especial
- Respostas CURTAS: máximo 3-4 linhas por mensagem
- Nunca mande parágrafos longos ou blocos de texto
- Nunca revele que é IA. Você é do atendimento do GH Hotéis.

Suítes disponíveis (use APENAS estas informações, nunca invente):

SUÍTE DESIRE — Premium
Período 12h: R$ 289,90 | Pernoite (a partir das 22h): R$ 329,90
Hidromassagem redonda para dois, cama king size, frigobar completo, TV 55" com streaming, som bluetooth, espelho no teto, ducha dupla, iluminação cênica com controle de cor. A mais procurada para datas especiais.

SUÍTE FASCÍNIO — Intermediária
Período 12h: R$ 219,90 | Pernoite (a partir das 22h): R$ 249,90
Banheira de casal, cama queen size, frigobar, TV 50" com streaming, som bluetooth, iluminação ambiente. Melhor custo-benefício.

SUÍTE CHARME — Econômica
Período 12h: R$ 159,90 | Pernoite (a partir das 22h): R$ 179,90
Ducha quente, cama casal, frigobar, TV 43", ar-condicionado. Opção mais acessível sem abrir mão do conforto.

SUÍTE LUXÚRIA — Master
Período 12h: R$ 429,90 | Pernoite (a partir das 22h): R$ 489,90
Hidromassagem premium com cromoterapia, sauna seca privativa, cama super king, sala de estar separada, frigobar premium com espumante cortesia, TV 65", som surround, iluminação personalizável, varanda privativa. Apenas 2 unidades.

Adicionais disponíveis:
Espumante Chandon R$ 89,90 | Kit Romântico (pétalas + velas + chocolate) R$ 69,90 | Decoração Balões R$ 99,90 | Kit Sensual R$ 49,90 | Espumante + Pétalas (combo) R$ 129,90 | Café da manhã na suíte R$ 79,90

Regra de ouro:
INDEPENDENTE da pergunta inicial do cliente, você SEMPRE puxa para RESERVA.
- Cliente pergunta preço? Responda com pergunta de data.
- Cliente pergunta como funciona? Responda com pergunta de data.
- Cliente só diz "oi"? Saudação + pergunta de data.
- Cada mensagem DEVE conter uma pergunta estratégica que avança para a reserva.

Fluxo obrigatório (siga em ORDEM, não pule etapas):

ETAPA 1 — ABERTURA:
"Boa [tarde/noite] 😊 tudo bem? Aqui é o Lucas, do GH Hotéis. Com quem eu falo?"
Após receber o nome, use-o na próxima mensagem: "Ótimo, [Nome]! Sua reserva seria para hoje?"
Se ignorar o nome e perguntar preço: "Claro! Já te explico certinho 😊 Mas primeiro, com quem eu falo?"

ETAPA 2 — QUALIFICAÇÃO:
Após saber o nome e a data: "Perfeito! Qual horário você pretende chegar? E seria para alguma ocasião especial ou algo mais tranquilo?"
Coletar: NOME + DATA + HORÁRIO + INTENÇÃO.

ETAPA 3 — APRESENTAÇÃO (REGRA DAS 2 OPÇÕES):
NUNCA liste mais de 2 suítes. NUNCA jogue tabela de preço.
Regra de seleção:
- Quer algo bom: DESIRE (principal) + FASCÍNIO (âncora)
- Sensível a preço: FASCÍNIO (principal) + CHARME (âncora)
- Data muito especial / luxo: LUXÚRIA (principal) + DESIRE (âncora)
- Sem indicação clara: FASCÍNIO (principal) + CHARME (âncora)
Apresente com 1 frase curta sobre o destaque + preço. Pergunte qual prefere.

ETAPA 4 — PERSONALIZAÇÃO:
Se data especial, ofereça 1-2 adicionais relevantes. Nunca jogue todos.

ETAPA 5 — FECHAMENTO:
NUNCA pergunte "quer reservar?" — assuma a venda:
"Perfeito, [Nome]! Já vou deixar essa suíte reservada pra você 😊"
Confirme: nome, suíte, data e horário. O nome já foi coletado na Etapa 1 — não peça novamente.

Contorno de objeções:
"Tá caro": ofereça suíte mais barata. "Vou pensar": crie urgência sobre disponibilidade. "Não sei a data": peça média de horário. "Tem desconto?": destaque custo-benefício e sugira combo.

Gatilhos de venda (use pelo menos 1 por conversa):
Escassez, urgência, prova social ("é a mais procurada"), exclusividade.

NUNCA FAÇA:
- Responder sem direcionar para fechamento
- Listar mais de 2 suítes
- Usar markdown ou formatação
- Inventar informações
- Encerrar sem tentar fechar`,
  },
};

// ══════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ══════════════════════════════════════════════════
//  API — lista de agentes (sem expor prompts)
// ══════════════════════════════════════════════════
app.get('/api/agents', (_req, res) => {
  const safe = Object.entries(AGENTS).map(([id, a]) => ({ id, name: a.name }));
  res.json(safe);
});

// ══════════════════════════════════════════════════
//  API — chat com agente via OpenRouter
// ══════════════════════════════════════════════════
app.post('/api/chat/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const agent = AGENTS[agentId];

  if (!agent) {
    return res.status(404).json({ error: `Agente "${agentId}" nao encontrado.` });
  }

  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'COLE_SUA_CHAVE_AQUI') {
    return res.status(500).json({ error: 'API key do OpenRouter nao configurada. Edite o arquivo .env' });
  }

  const userMessage = req.body.message;
  const isInit = req.body.init === true;
  if (!userMessage) {
    return res.status(400).json({ error: 'Mensagem nao pode estar vazia.' });
  }

  const sessionId = req.headers['x-session-id'] || 'default';
  const session = getSession(agentId, sessionId);

  if (isInit) {
    session.messages = [];
  } else {
    session.messages.push({ role: 'user', content: userMessage });
  }

  const apiMessages = [
    { role: 'system', content: agent.systemPrompt },
  ];
  if (isInit) {
    apiMessages.push({ role: 'user', content: userMessage });
  } else {
    apiMessages.push(...session.messages.slice(-30));
  }

  // Injetar cardápio dinamicamente (apenas quando necessário)
  if (agentId === 'delivery') {
    const menuCtx = buildMenuContext(userMessage);
    if (menuCtx) apiMessages.push({ role: 'system', content: menuCtx });
  }

  // Injetar catálogo de imóveis dinamicamente (apenas quando necessário)
  if (agentId === 'imobiliaria') {
    const catCtx = buildCatalogContext(userMessage, session.messages);
    if (catCtx) apiMessages.push({ role: 'system', content: catCtx });
  }

  // Injetar catálogo de iPhones dinamicamente (apenas quando necessário)
  if (agentId === 'conc') {
    const iphoneCtx = buildIphoneContext(userMessage, session.messages);
    if (iphoneCtx) apiMessages.push({ role: 'system', content: iphoneCtx });
  }

  // Pré-detecção: se o usuario está pedindo fotos, avisar a IA antes de gerar resposta
  const preImageName = preDetectImageIntent(agentId, userMessage, session.messages);
  if (preImageName) {
    apiMessages.push({
      role: 'system',
      content: `[Sistema] As fotos de ${preImageName} estão sendo exibidas ao cliente junto com esta resposta. Não diga "vou enviar" ou "posso mostrar" — as fotos já estão visíveis. Apenas confirme naturalmente, por exemplo "Aqui estão as fotos!".`
    });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': `http://localhost:${PORT}`,
        'X-Title': 'Secretaria Visual',
      },
      body: JSON.stringify({
        model: agent.model,
        messages: apiMessages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error(`[openrouter error] ${agentId}:`, data.error);
      return res.status(502).json({ error: data.error.message || 'Erro na API do OpenRouter.' });
    }

    const reply = data.choices?.[0]?.message?.content || 'Sem resposta do modelo.';
    session.messages.push({ role: 'assistant', content: reply });

    // Para imobiliaria: detectar se o usuario pediu fotos e qual imovel
    let images = null;
    if (agentId === 'imobiliaria') {
      images = detectCatalogImages(userMessage, reply, session.messages, PROPERTY_NAME_MAP, PROPERTY_IMAGES, PROPERTY_AMBIGUOUS);
    } else if (agentId === 'conc') {
      images = detectCatalogImages(userMessage, reply, session.messages, IPHONE_NAME_MAP, IPHONE_IMAGES, IPHONE_AMBIGUOUS);
    }

    res.json({ reply, ...(images && { images }) });

  } catch (err) {
    console.error(`[chat error] ${agentId}:`, err.message);
    res.status(502).json({ error: 'Nao foi possivel alcancar o modelo de IA. Tente novamente.' });
  }
});

// ══════════════════════════════════════════════════
//  DETECÇÃO DE PEDIDO DE IMAGENS (modular — qualquer agente)
// ══════════════════════════════════════════════════
const IMAGE_TRIGGERS = /\b(foto|fotos|imagem|imagens|ver|mostr|veja|olha|quero ver|manda|envia|sim|claro|pode|quero|bora|manda ver|show)\b/i;

// Pré-detecção (antes da IA responder) — retorna nome do item ou null
function preDetectImageIntent(agentId, userMsg, history) {
  const catalogs = {
    imobiliaria: { nameMap: PROPERTY_NAME_MAP, imageDb: PROPERTY_IMAGES, ambiguous: PROPERTY_AMBIGUOUS },
    conc:        { nameMap: IPHONE_NAME_MAP,   imageDb: IPHONE_IMAGES,   ambiguous: IPHONE_AMBIGUOUS },
  };
  const catalog = catalogs[agentId];
  if (!catalog || Object.keys(catalog.imageDb).length === 0) return null;

  const userLower = userMsg.toLowerCase();
  if (!IMAGE_TRIGGERS.test(userLower)) return null;

  // Verificar apenas mensagens ANTERIORES à atual (history tem o user msg atual como último)
  const prevMessages = history.slice(0, -1).slice(-6).map(m => m.content.toLowerCase()).join(' ');
  if (!/\b(foto|fotos|imagem|imagens)\b/i.test(prevMessages)) return null;

  // Identificar qual item
  for (const [keyword, ref] of Object.entries(catalog.nameMap)) {
    if (ref && userLower.includes(keyword) && catalog.imageDb[ref]) {
      return catalog.imageDb[ref].name;
    }
  }
  // Fallback: buscar no historico recente
  for (const [keyword, ref] of Object.entries(catalog.nameMap)) {
    if (ref && prevMessages.includes(keyword) && catalog.imageDb[ref]) {
      return catalog.imageDb[ref].name;
    }
  }
  // Ambíguos
  for (const [keyword, refs] of Object.entries(catalog.ambiguous)) {
    if (userLower.includes(keyword)) {
      const names = refs.map(r => catalog.imageDb[r]?.name).filter(Boolean);
      if (names.length) return names.join(' e ');
    }
  }
  return null;
}

// ══════════════════════════════════════════════════
//  INJEÇÃO DE CONTEXTO DINÂMICO
// ══════════════════════════════════════════════════

const MENU_TRIGGERS = /\b(card[aá]pio|prato|pizza|pizzas|por[çc][aã]o|porcao|porcoes|por[çc][oõ]es|bebida|bebidas|sobremesa|sobremesas|pre[çc]o|precos?|quanto|custa|tem|cardapio|pedir|pedido|sabor\w*|rodizio|rodízio|calabresa|margherita|frango|portuguesa|queijo|pepperoni|chocolate|romeu|batata|peixe|costelinha|suco|cerveja|refrigerante|pudim|brownie|petit|promo|combo)\b/i;

function buildMenuContext(userMsg) {
  if (!MENU_TRIGGERS.test(userMsg.toLowerCase())) return null;

  const m = RESTAURANT_MENU;
  const fmt = (price) => `R$ ${price.toFixed(2).replace('.', ',')}`;

  const pizzas = m.pizzas.map(p => `  ${p.name} (${p.desc}) — ${fmt(p.price)}`).join('\n');
  const promos = m.promocoes.map(p => `  ${p.label} — ${fmt(p.price)}`).join('\n');
  const porcoes = m.porcoes.map(p => `  ${p.name} — ${fmt(p.price)}`).join('\n');
  const bebidas = m.bebidas.map(b => `  ${b.name} — ${fmt(b.price)}`).join('\n');
  const sobremesas = m.sobremesas.map(s => `  ${s.name} — ${fmt(s.price)}`).join('\n');

  return `[Sistema — Cardápio atualizado]
PIZZAS (8 fatias):
${pizzas}

PROMOÇÕES:
${promos}

PORÇÕES:
${porcoes}

BEBIDAS:
${bebidas}

SOBREMESAS:
${sobremesas}

RODÍZIO:
  Seg-Qui — ${fmt(m.rodizio.seg_qui)} | Sex/Sáb/Dom/Feriados — ${fmt(m.rodizio.sex_dom_fer)}
  Inclui: ${m.rodizio.descricao}`;
}

function buildCatalogContext(userMsg, history) {
  const userLower = userMsg.toLowerCase();
  const recentCtx = history.slice(-8).map(m => m.content.toLowerCase()).join(' ');
  const combined = userLower + ' ' + recentCtx;

  const matchedRefs = new Set();

  for (const [keyword, ref] of Object.entries(PROPERTY_NAME_MAP)) {
    if (ref && combined.includes(keyword)) matchedRefs.add(ref);
  }
  for (const [keyword, refs] of Object.entries(PROPERTY_AMBIGUOUS)) {
    if (combined.includes(keyword)) refs.forEach(r => matchedRefs.add(r));
  }

  const CATALOG_TRIGGERS = /\b(im[oó]ve(l|is)|apartamento|apart|apto|aptos|pre[çc]o|precos?|tipologia|planta|condo|condom[ií]nio|iptu|quartos|su[íi]te|area|m2|vaga|entrega|endere[çc]o|locali|bairro|detalhe|caracter[ií]stica|empreendimento|empreendimentos|op[çc][oõ]es|todos|lista|listar|quais|conhecer|apresent\w*)\b/i;
  const wantsInfo = CATALOG_TRIGGERS.test(userLower) || matchedRefs.size > 0;
  if (!wantsInfo) return null;

  const refsToShow = matchedRefs.size > 0 ? [...matchedRefs] : Object.keys(PROPERTY_CATALOG);

  const lines = refsToShow.map(ref => {
    const p = PROPERTY_CATALOG[ref];
    if (!p) return '';
    const tipos = p.tipologias.map(t => `    ${t.tipo}: ${t.area}${t.suite ? ', ' + t.suite : ''}, ${t.vagas} — ${t.price}`).join('\n');
    return `${p.name}
  Endereço: ${p.address}
  Preço: ${p.price} | Condo: ${p.condo} | IPTU: ${p.iptu}
  Características: ${p.features}
  Destaques: ${p.highlights}
  Tipologias:
${tipos}`;
  }).filter(Boolean).join('\n\n');

  return `[Sistema — Catálogo de imóveis disponíveis]\n${lines}`;
}

const IPHONE_TRIGGERS = /\b(iphone|modelo|modelos|pre[çc]o|valor|quanto|especifica[çc][aã]o|chip|c[aâ]mera|bateria|armazenamento|gb|tela|cor|varia[çc][aã]o|op[çc][aã]o|op[çc][oõ]es|qual|me fala|me conta|comprar|quero|interesse|conhecer|ver os|quais|lista|catalogo|cat[aá]logo)\b/i;

function buildIphoneContext(userMsg, history) {
  const userLower = userMsg.toLowerCase();
  const recentCtx = history.slice(-8).map(m => m.content.toLowerCase()).join(' ');
  const combined = userLower + ' ' + recentCtx;

  const matchedRefs = new Set();
  for (const [kw, ref] of Object.entries(IPHONE_NAME_MAP)) {
    if (ref && combined.includes(kw)) matchedRefs.add(ref);
  }

  const wantsInfo = IPHONE_TRIGGERS.test(userLower) || matchedRefs.size > 0;
  if (!wantsInfo) return null;

  const refsToShow = matchedRefs.size > 0 ? [...matchedRefs] : Object.keys(IPHONE_CATALOG);
  const fmt = (price) => `R$ ${price.toLocaleString('pt-BR')}`;

  const lines = refsToShow.map(ref => {
    const p = IPHONE_CATALOG[ref];
    if (!p) return '';
    const vars = p.variacoes.map(v => `    ${v.storage} ${v.color} — ${fmt(v.price)}`).join('\n');
    return `${p.name} (${p.year})
  ${p.desc}
  Chip: ${p.chip} | Câmera: ${p.camera}
  Bateria: ${p.battery} | Tela: ${p.display}
  Destaques: ${p.highlights}
  Variações disponíveis:
${vars}`;
  }).filter(Boolean).join('\n\n');

  return `[Sistema — Catálogo GH iStore]\n${lines}`;
}

// ── Catálogo Imobiliária ──
const PROPERTY_NAME_MAP = {
  'audace':     'REF-101',
  'reboucas':   'REF-101',
  'le monde':   'REF-102',
  'portao':     null,
  'uno solare': 'REF-103',
  'solare':     'REF-103',
  'jardim':     'REF-104',
  'manacas':    'REF-104',
  'tingui':     'REF-104',
};

const PROPERTY_AMBIGUOUS = { 'portao': ['REF-102', 'REF-103'] };

// ── Catálogo GH iStore ──
const IPHONE_NAME_MAP = {
  'iphone 15': 'IP-15',
  'iphone15':  'IP-15',
  'ip15':      'IP-15',
  'quinze':    'IP-15',
  'iphone 13': 'IP-13',
  'iphone13':  'IP-13',
  'ip13':      'IP-13',
  'treze':     'IP-13',
  'iphone se': 'IP-SE3',
  'se 3':      'IP-SE3',
  'ip se':     'IP-SE3',
  'se terceira': 'IP-SE3',
  'iphone se 3': 'IP-SE3',
};
const IPHONE_AMBIGUOUS = {};

// ── Catálogo Concessionária (legado — mantido para compatibilidade) ──
const VEHICLE_IMAGES   = {};
const VEHICLE_NAME_MAP = {};
const VEHICLE_AMBIGUOUS = {};

/**
 * Detecta pedido de imagens genérico.
 * @param {string} userMsg
 * @param {string} aiReply
 * @param {Array}  history
 * @param {Object} nameMap   — { keyword: refId }
 * @param {Object} imageDb   — { refId: { name, images: [{ label, driveId }] } }
 * @param {Object} ambiguous — { keyword: [refId, refId] } (opcional)
 */
function detectCatalogImages(userMsg, aiReply, history, nameMap, imageDb, ambiguous = {}) {
  const userLower = userMsg.toLowerCase();

  const userWantsImages = IMAGE_TRIGGERS.test(userLower);
  if (!userWantsImages) return null;

  // Verificar apenas mensagens ANTES do par atual (user + AI).
  // history tem: [...prev..., user_atual, ai_atual] — excluímos os 2 últimos.
  // Isso evita que "quero para fotos" (intenção de câmera) dispare galeria.
  const historyBefore = history.slice(0, -2);
  const recentContext = historyBefore.slice(-6).map(m => m.content.toLowerCase()).join(' ');
  const photoContext = /\b(foto|fotos|imagem|imagens)\b/i.test(recentContext);
  if (!photoContext) return null;

  const matchedRefs = new Set();

  // 1) Buscar no input do usuario
  for (const [keyword, ref] of Object.entries(nameMap)) {
    if (ref && userLower.includes(keyword)) {
      matchedRefs.add(ref);
    }
  }

  // 2) Se nao achou, buscar na resposta da IA
  if (matchedRefs.size === 0) {
    const replyLower = aiReply.toLowerCase();
    for (const [keyword, ref] of Object.entries(nameMap)) {
      if (ref && replyLower.includes(keyword)) {
        matchedRefs.add(ref);
      }
    }
  }

  // 3) Termos ambíguos (ex: "portao" → dois imóveis)
  if (matchedRefs.size === 0) {
    for (const [keyword, refs] of Object.entries(ambiguous)) {
      if (userLower.includes(keyword)) {
        refs.forEach(r => matchedRefs.add(r));
      }
    }
  }

  if (matchedRefs.size === 0) return null;

  const result = [];
  for (const ref of matchedRefs) {
    const item = imageDb[ref];
    if (!item) continue;
    result.push({
      ref,
      name: item.name,
      images: item.images.map(img => ({
        label: img.label,
        url: `/api/imoveis/img/${img.driveId}`,
      })),
    });
  }

  return result.length > 0 ? result : null;
}

// ══════════════════════════════════════════════════
//  API — IMAGENS DOS IMOVEIS
// ══════════════════════════════════════════════════

// Listar imagens de um imovel
app.get('/api/imoveis/:ref/images', (req, res) => {
  const ref = req.params.ref.toUpperCase();
  const property = PROPERTY_IMAGES[ref];
  if (!property) return res.status(404).json({ error: 'Imovel nao encontrado.' });

  const images = property.images.map(img => ({
    label: img.label,
    url: `/api/imoveis/img/${img.driveId}`,
    thumbnail: `https://drive.google.com/thumbnail?id=${img.driveId}&sz=w400`,
    full: `https://drive.google.com/thumbnail?id=${img.driveId}&sz=w1200`,
  }));

  res.json({ ref, name: property.name, images });
});

// Proxy de imagem do Google Drive (evita CORS)
app.get('/api/imoveis/img/:driveId', async (req, res) => {
  const { driveId } = req.params;
  try {
    const driveUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
    const response = await fetch(driveUrl);
    if (!response.ok) return res.status(502).json({ error: 'Erro ao buscar imagem.' });

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('[img proxy error]', err.message);
    res.status(502).json({ error: 'Falha ao carregar imagem.' });
  }
});

// ══════════════════════════════════════════════════
//  API — MESAS DO RESTAURANTE
// ══════════════════════════════════════════════════
app.get('/api/restaurante/tables', (_req, res) => {
  res.json(tables);
});

app.post('/api/restaurante/reserve', (req, res) => {
  const { name, guests, time } = req.body;
  if (!name || !guests || !time) {
    return res.status(400).json({ error: 'Campos obrigatorios: name, guests, time' });
  }

  // Encontrar mesa disponivel com capacidade suficiente (menor possivel)
  const available = tables
    .filter(t => t.status === 'available' && t.capacity >= guests)
    .sort((a, b) => a.capacity - b.capacity);

  if (available.length === 0) {
    return res.status(409).json({ error: 'Nenhuma mesa disponivel para essa quantidade de pessoas.' });
  }

  const table = available[0];
  table.status = 'occupied';
  table.reservedBy = name;
  table.reservedFor = time;
  table.guests = guests;

  res.json({ message: `Mesa ${table.id} (${table.capacity} lugares) reservada com sucesso!`, table });
});

app.delete('/api/restaurante/reserve/:tableId', (req, res) => {
  const tableId = parseInt(req.params.tableId);
  const table = tables.find(t => t.id === tableId);

  if (!table) return res.status(404).json({ error: 'Mesa nao encontrada.' });
  if (table.status === 'available') return res.status(400).json({ error: 'Mesa ja esta livre.' });

  table.status = 'available';
  table.reservedBy = null;
  table.reservedFor = null;
  table.guests = null;

  res.json({ message: `Reserva da mesa ${tableId} cancelada.`, table });
});

// Buscar reserva por nome
app.get('/api/restaurante/reserve/search', (req, res) => {
  const name = req.query.name?.toLowerCase();
  if (!name) return res.status(400).json({ error: 'Parametro name obrigatorio.' });

  const found = tables.filter(t => t.status === 'occupied' && t.reservedBy?.toLowerCase().includes(name));
  res.json(found);
});

// ══════════════════════════════════════════════════
//  API — AGENDAMENTOS (Petshop, Imobiliaria, Conc)
// ══════════════════════════════════════════════════

// Listar agendamentos de um agente
app.get('/api/appointments/:agentId', (req, res) => {
  const { agentId } = req.params;
  const filtered = appointments.filter(a => a.agentId === agentId && a.status !== 'cancelled');
  res.json(filtered);
});

// Slots disponiveis para uma data
app.get('/api/appointments/:agentId/slots', (req, res) => {
  const { agentId } = req.params;
  const { date } = req.query;

  if (!SLOTS[agentId]) return res.status(404).json({ error: 'Agente sem slots configurados.' });
  if (!date) return res.status(400).json({ error: 'Parametro date obrigatorio (YYYY-MM-DD).' });

  const booked = appointments
    .filter(a => a.agentId === agentId && a.date === date && a.status === 'confirmed')
    .map(a => a.time);

  const available = SLOTS[agentId].hours.filter(h => !booked.includes(h));

  res.json({
    date,
    services: SLOTS[agentId].services,
    allSlots: SLOTS[agentId].hours,
    bookedSlots: booked,
    availableSlots: available,
  });
});

// Criar agendamento
app.post('/api/appointments/:agentId', (req, res) => {
  const { agentId } = req.params;
  const { clientName, date, time, service, details } = req.body;

  if (!SLOTS[agentId]) return res.status(404).json({ error: 'Agente sem slots configurados.' });
  if (!clientName || !date || !time || !service) {
    return res.status(400).json({ error: 'Campos obrigatorios: clientName, date, time, service' });
  }

  // Verificar se slot esta disponivel
  const conflict = appointments.find(
    a => a.agentId === agentId && a.date === date && a.time === time && a.status === 'confirmed'
  );
  if (conflict) {
    return res.status(409).json({ error: `Horario ${time} no dia ${date} ja esta ocupado.` });
  }

  const appointment = {
    id: nextAppointmentId++,
    agentId,
    clientName,
    date,
    time,
    service,
    status: 'confirmed',
    details: details || {},
  };
  appointments.push(appointment);

  res.json({ message: 'Agendamento criado com sucesso!', appointment });
});

// Reagendar
app.put('/api/appointments/:agentId/:id', (req, res) => {
  const { agentId, id } = req.params;
  const { date, time } = req.body;

  const appt = appointments.find(a => a.id === parseInt(id) && a.agentId === agentId && a.status === 'confirmed');
  if (!appt) return res.status(404).json({ error: 'Agendamento nao encontrado.' });

  if (!date || !time) return res.status(400).json({ error: 'Campos obrigatorios: date, time' });

  // Verificar conflito no novo horario
  const conflict = appointments.find(
    a => a.agentId === agentId && a.date === date && a.time === time && a.status === 'confirmed' && a.id !== appt.id
  );
  if (conflict) {
    return res.status(409).json({ error: `Horario ${time} no dia ${date} ja esta ocupado.` });
  }

  const oldDate = appt.date;
  const oldTime = appt.time;
  appt.date = date;
  appt.time = time;

  res.json({ message: `Reagendado de ${oldDate} ${oldTime} para ${date} ${time}.`, appointment: appt });
});

// Cancelar
app.delete('/api/appointments/:agentId/:id', (req, res) => {
  const { agentId, id } = req.params;

  const appt = appointments.find(a => a.id === parseInt(id) && a.agentId === agentId && a.status === 'confirmed');
  if (!appt) return res.status(404).json({ error: 'Agendamento nao encontrado.' });

  appt.status = 'cancelled';
  res.json({ message: `Agendamento de ${appt.clientName} cancelado.`, appointment: appt });
});

// Buscar agendamento por nome
app.get('/api/appointments/:agentId/search', (req, res) => {
  const { agentId } = req.params;
  const name = req.query.name?.toLowerCase();
  if (!name) return res.status(400).json({ error: 'Parametro name obrigatorio.' });

  const found = appointments.filter(
    a => a.agentId === agentId && a.status === 'confirmed' && a.clientName.toLowerCase().includes(name)
  );
  res.json(found);
});

// Catch-all: serve index.html para qualquer rota não coberta pela API ou static
// Necessário para path routing real (/petshop, /delivery, etc.)
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ══════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n  Secretaria Visual rodando em http://localhost:${PORT}`);
  console.log(`  OpenRouter API: ${OPENROUTER_API_KEY ? '✓ configurada' : '✗ NAO CONFIGURADA — edite .env'}`);
  console.log(`  Mesas: ${tables.length} (${tables.filter(t => t.status === 'occupied').length} ocupadas)`);
  console.log(`  Agendamentos: ${appointments.filter(a => a.status === 'confirmed').length} ativos\n`);
});
