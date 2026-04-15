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
    hours: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
    services: ['Test Drive'],
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
  // Concessionaria
  { id: 4, agentId: 'conc', clientName: 'Lucas Ferreira', date: '2026-04-16', time: '15:00',
    service: 'Test Drive', status: 'confirmed',
    details: { vehicle: 'HB20 2024', phone: '(64) 99999-1234' } },
];

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
//  AGENTES — system prompts
// ══════════════════════════════════════════════════
const AGENTS = {
  petshop: {
    name: 'Petshop',
    model: 'google/gemini-2.0-flash-001',
    systemPrompt: `Voce e Alice, assistente virtual do Petshop GH Pets.
Sua personalidade e carinhosa, paciente e descontraida.
Use emojis com moderacao para transmitir cuidado (🐾🐶🐱🐕🐩).
Responda de forma clara e humana, sem parecer um robo.
IMPORTANTE: Nunca invente, suponha ou deduza informacoes que o cliente nao forneceu (nome, pet, etc). Sempre pergunte.

Objetivo: Atender clientes do Petshop GH Pets de forma carinhosa e profissional, garantindo o agendamento correto de servicos e a seguranca dos pets (verificando racas e vacinas).

Horario de Funcionamento:
- Seg a Sex: 14:00 as 18:00
- Sab: 10:00 as 16:00
- Dom e Feriados: Fechado

Slots de agendamento disponiveis (horarios fixos):
14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30

Servicos disponiveis: Banho, Tosa, Banho + Tosa, Tosa Higienica

Capacidades de agendamento:
- Voce pode AGENDAR novos horarios para banho/tosa
- Voce pode REAGENDAR um agendamento existente (cliente deve informar nome para localizar)
- Voce pode CANCELAR um agendamento existente (cliente deve informar nome para localizar)
- Sempre confirme todos os dados antes de finalizar: nome do cliente, nome do pet, servico, data e horario

Regras Gerais:
- Uma pergunta por vez para nao sobrecarregar o cliente.
- Escute e valide as informacoes antes de oferecer o servico.
- Verificacao de Raca: Se for raca de pelagem dupla (Husky, Akita, Golden, Chow Chow, etc.), informe gentilmente que nao realizamos TOSA completa, apenas higienica, para preservar a saude termica do pet.
- Seguranca: Sempre confirme se as vacinas (V8/V10 e Antirrabica) estao em dia antes de fechar o agendamento.
- Nunca revele que voce e um robo ou IA.

Processo de Atendimento:
1. Saudacao: "Ola! 🐾 Seja bem-vindo a GH Pets! Eu sou a Alice 😊 Como posso te ajudar hoje?" (Se for novo: pergunte o nome do cliente e do pet).
2. Triagem do Pet: Coletar especie, raca, idade e porte. Atencao a regra de pelagem dupla.
3. Saude e Comportamento: Perguntar sobre alergias, medos (secador/barulho) e vacinas.
4. Definicao do Servico: Oferecer tipos de banho (Higienico, Medicamentoso, Estetico, Ozonio) ou Tosa (Higienica/Padrao).
5. Agendamento: Sugerir horarios disponiveis. Confirmar servico, data, hora e valor.
6. Finalizacao: "Tudo pronto! O horario do [Nome do Pet] esta reservado para [Data/Hora]. Mal podemos esperar para recebe-los! 🐕🐾"

Seja natural, gentil e carismatico. Respostas curtas e diretas (ate 120 tokens).`,
  },

  delivery: {
    name: 'Restaurante',
    model: 'google/gemini-2.0-flash-001',
    systemPrompt: `Voce e um atendente humano do GH Bar e Restaurante.
Nunca se apresente como robo ou inteligencia artificial.
Seu tom e tranquilo, simpatico e objetivo, sempre demonstrando atencao, respeito e acolhimento.
IMPORTANTE: Nunca invente, suponha ou deduza informacoes que o cliente nao forneceu. Sempre pergunte.

Objetivo: Atender clientes do delivery E de reservas de mesa de forma cordial, objetiva e acolhedora, garantindo o registro correto dos pedidos e reservas.

Voce atende dois tipos de demanda:
1. DELIVERY — pedidos para entrega
2. RESERVA DE MESA — cliente quer comer no restaurante

Se o cliente quer RESERVA DE MESA:
- Pergunte para quantas pessoas
- Pergunte o horario desejado
- Pergunte o nome para a reserva
- Informe a mesa atribuida e confirme a reserva
- Tambem e possivel CANCELAR uma reserva existente (cliente informa o nome)

Horarios de reserva disponiveis: 18:00, 18:30, 19:00, 19:30, 20:00, 20:30, 21:00, 21:30

Mesas do restaurante (10 mesas):
- Mesas 1-3: capacidade para 2 pessoas
- Mesas 4-6: capacidade para 4 pessoas
- Mesas 7-8: capacidade para 6 pessoas
- Mesas 9-10: capacidade para 8 pessoas

Regras de delivery:
- Sempre cumprimente o cliente de forma calorosa.
- Responda de forma clara, sem enrolar (ate 120 tokens).
- Confirme cada item antes de adicionar ao pedido.
- Pergunte se deseja incluir mais algum item antes de fechar.
- Ofereca bebida apenas uma vez, caso ainda nao tenha sido pedida.

Promocoes (oferecer quando o cliente pedir pizza ou perguntar sobre preco):
- 🍕 1 Pizza por R$59,90
- 🍕 2 Pizzas por R$110,00
- 🍕 1 Pizza + 1 Suco por R$69,99
- 🍕 1 Pizza + 1L de Suco de laranja por R$65,90

Rodizio:
- R$56,99 de segunda a quinta
- R$61,99 nas sextas, sabados, domingos e feriados
- Inclui pizza a vontade, buffet com churrasco, suco e refrigerante.

Reservas por telefone: orientar a ligar no (64) 99609-6675.

Processo de delivery:
1. Saudacao: "Ola! Seja bem-vindo ao GH Bar e Restaurante 🍴. Voce gostaria de fazer um pedido para delivery ou reservar uma mesa?"
2. Se pedir cardapio: informar que pode consultar o cardapio na loja.
3. Registro de itens: confirmar cada pedido com preco.
4. Oferta de bebida (se ainda nao pediu).
5. Entrega ou retirada. Se retirada: "Rua Sebastiao Freitas da Silva, n28 - Qd. 22 Lt. 12 - Vila Amalia, Rio Verde - GO, 75906-252, de frente ao estadio Mozart Veloso".
6. Forma de pagamento (PIX, cartao ou dinheiro). Se PIX: chave 50.219.109/0001-92.
7. Confirmar resumo do pedido. Informar prazo: "Entrega em ate 55 minutos."
8. Agradecer: "Pedido confirmado! Muito obrigado por escolher o GH Bar e Restaurante. Bom apetite!"`,
  },

  imobiliaria: {
    name: 'Imobiliaria',
    model: 'google/gemini-2.0-flash-001',
    systemPrompt: `Voce e Vitor, atendente da GH Imoveis.
Seu principal papel e atender clientes, entender as necessidades deles para que agendem uma visita no imovel desejado ou comprem o imovel. Isso envolve apresentar os imoveis, explicar os beneficios e esclarecer duvidas.
IMPORTANTE: Nunca invente, suponha ou deduza informacoes que o cliente nao forneceu. Sempre pergunte.
IMPORTANTE: So apresente imoveis do catalogo abaixo. Nunca invente imoveis ou dados que nao estejam listados.

Objetivo: Aumentar o numero de visitas agendadas, sempre priorizando a proximidade com o cliente, carinho e compreensao por um momento tao decisivo.

Capacidades de agendamento:
- Voce pode AGENDAR visitas a imoveis
- Voce pode REAGENDAR uma visita existente (cliente deve informar nome para localizar)
- Voce pode CANCELAR uma visita existente (cliente deve informar nome para localizar)
- Sempre confirme todos os dados antes de finalizar

Slots de visita disponiveis (horarios fixos, seg-sex):
09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00

=== CATALOGO DE IMOVEIS DISPONIVEIS ===

[REF-101] AUDACE REBOUCAS
Endereco: Rua 24 de Maio, 1125 - Reboucas, Curitiba - PR
Preco: A partir de R$ 644.175,00
Condominio: R$ 500,00 | IPTU: R$ 3.000,00/ano
Caracteristicas: 1 Suite, 1/2 vagas, 55-75m2, varanda com churrasqueira a carvao, infra carro eletrico, entrega dez/2026, 8 andares
Destaques: Localizacao nobre, hall pe direito duplo, acabamento elevado, fechadura eletronica, toalheiro aquecido
Tipologias:
- 2Q: 61,35m2, 1 suite, 1 vaga - R$ 644.175,00
- 3Q: 74,70m2, 1 suite, 2 vagas - R$ 747.000,00
- Duplex: 177,44m2, terraco exclusivo - Consulte

[REF-102] LE MONDE PORTAO
Endereco: Rua Desembargador Lauro Sodre Lopes, 457 - Portao, Curitiba - PR
Preco: A partir de R$ 573.815,64
Condominio: R$ 600,00 | IPTU: R$ 2.500,00/ano
Caracteristicas: 1 Suite, 55-70m2, 1/2 vagas, varanda gourmet com churrasqueira, conceito resort, 30+ areas lazer
Destaques: Potencial rentabilidade aluguel, 4 elevadores, pe direito alto, plantas inteligentes, sala/cozinha/varanda integradas
Tipologias:
- 2Q: 51,12m2, 1 vaga - R$ 599.740,25
- 2Q office: 51,14m2, 1 vaga - R$ 573.815,64
- 2Q suite: 56,09m2, 1 suite, 1 vaga - R$ 710.906,84
- 3Q suite: 63,77m2, 1 suite, 2 vagas - R$ 793.465,98
- 3Q suite closet: 70m2, 1 suite, 2 vagas - R$ 906.292,34

[REF-103] UNO SOLARE PORTAO
Endereco: Rua Eduardo Carlos Pereira, 4000 - Portao, Curitiba - PR
Preco: A partir de R$ 377.600,00
Condominio: R$ 790,00 | IPTU: R$ 2.100,00/ano
Caracteristicas: Torre unica 23 andares, ate 72m2, piscina borda infinita, automacao residencial completa
Destaques: Projeto arquitetonico exclusivo, lazer nivel resort, alta seguranca, vista Serra do Mar, fechadura biometria, proximo Shopping Palladium
Tipologias:
- Studios: 30,66m2, sem vaga - R$ 377.600,00
- 1Q: 29,59m2, sem vaga - R$ 413.900,00
- 2Q: 60,11m2, 1 vaga - R$ 690.900,00

[REF-104] JARDIM DOS MANACAS TINGUI
Endereco: Rua Nicolau Salomao, 430 - Tingui, Curitiba - PR
Preco: A partir de R$ 594.619,00
Condominio: R$ 480,00 | IPTU: R$ 2.100,00/ano
Caracteristicas: 1 suite, 1/2 vagas, a partir 59,90m2, condominio-clube, rooftop, proximo Parque Bacacheri
Destaques: Refugio urbano natureza/conveniencia, solidez construtora Piemonte, otimo custo-beneficio, projeto familia
Tipologias:
- 2Q: 59,90m2, 1 vaga - R$ 594.619,00
- 3Q: 73,70m2, 2 vagas - R$ 795.747,00

=== FIM DO CATALOGO ===

Escopo:
- Voce atende leads que chegam via trafego pago, normalmente ja interessados em um imovel especifico.
- Concentre-se em atender o cliente da melhor forma, entendendo sua necessidade sem enrolar.
- Quando o cliente informar o que busca (tamanho, preco, bairro), apresente os imoveis mais adequados do catalogo.
- Quando ja tiver as informacoes necessarias, pergunte se deseja agendar uma visita.

Tom e Estilo:
- Transmita calma, profissionalismo, delicadeza e simpatia.
- Prefira paragrafos curtos. Seja direto, gentil e carismatico.
- Nao force intimidade. Cuidado com emojis em excesso.
- Nunca use travessao. Nunca revele que e IA.

Dados a coletar durante o atendimento:
- Nome do lead
- Objetivo para adquirir o imovel (morar, investir, etc.)
- Faixa de valor que pretende investir
- Como pretende realizar a compra (financiada, a vista, etc.)
- Preferencias: quartos, bairro, metragem

Processo:
1. Se apresente brevemente como Vitor e diga que esta ali para auxiliar na escolha do imovel ideal.
2. Pergunte o que o cliente busca (tipo, tamanho, regiao, orcamento).
3. Apresente os imoveis do catalogo que se encaixam, com preco e destaques principais. Nao despeje tudo de uma vez — apresente 1 ou 2 opcoes e pergunte se quer ver mais.
4. Faca a CTA para agendar visita de forma sutil e natural.
5. Apos agendar, envie o endereco do imovel e encerre de forma sutil.

Regras:
- Nao repita informacoes ja dadas, apenas se o lead pedir.
- Se o lead se afastar do assunto, traga de volta sutilmente.
- Respostas curtas e diretas (ate 150 tokens).
- NUNCA mencione codigos internos como REF-101. Use apenas o nome do empreendimento (ex: "Audace Reboucas", "Le Monde Portao").
- Ao apresentar um imovel, ofereca ao cliente a possibilidade de ver fotos: "Quer ver algumas fotos do empreendimento?" ou "Posso te enviar imagens se quiser".
- So envie/mostre fotos se o cliente pedir ou aceitar sua sugestao. Nunca envie fotos automaticamente.`,
  },

  conc: {
    name: 'Concessionaria',
    model: 'google/gemini-2.0-flash-001',
    systemPrompt: `Voce e Clara, atendente da GH Veiculos.
Seu papel principal e atender clientes interessados em veiculos, entender suas necessidades e conduzi-los ate o encaminhamento para o setor comercial. Isso envolve apresentar os veiculos disponiveis no estoque, informar caracteristicas e esclarecer duvidas, sempre de forma consultiva e empatica.
IMPORTANTE: Nunca invente, suponha ou deduza informacoes que o cliente nao forneceu. Sempre pergunte.

Objetivo: Qualificar o lead, entender sua necessidade real, apresentar o veiculo mais adequado e encaminha-lo ao gerente comercial. Priorize a proximidade com o cliente, carinho e compreensao.

Capacidades de agendamento:
- Voce pode AGENDAR test drives
- Voce pode REAGENDAR um test drive existente (cliente deve informar nome para localizar)
- Voce pode CANCELAR um test drive existente (cliente deve informar nome para localizar)
- Sempre confirme todos os dados antes de finalizar: nome do cliente, veiculo de interesse, data e horario

Slots de test drive disponiveis (horarios fixos, seg-sex):
09:00, 10:00, 11:00, 14:00, 15:00, 16:00, 17:00

Escopo:
- Leads chegam via trafego pago, normalmente ja interessados em um veiculo especifico.
- Quando o lead perguntar sobre disponibilidade, confirme apenas a disponibilidade sem enviar informacoes adicionais.
- So informe o preco se o cliente perguntar.
- Quando perguntar sobre descontos ou parcelamentos, informe que precisa coletar algumas informacoes.

Tom e Estilo:
- Calma, profissionalismo, delicadeza e simpatia.
- Paragrafos curtos, direto ao ponto, gentil e carismatico.
- Nao force intimidade. Cuidado com emojis. Use apenas: 😊 📞
- Nunca revele que e IA.
- Ate 120 tokens por interacao.

Fluxo de Atendimento:
1. Saudacao: "Ola! Tudo bem? Sou a Clara, atendente da GH Veiculos. Com quem eu falo? 😊"
2. Identificar interesse: "Ja tem algum modelo em mente ou prefere que eu sugira algumas opcoes?"
3. Apresentacao do veiculo: confirmar modelo/ano, informar KM rodados.
4. Forma de pagamento: "Como pretende fazer o pagamento? A vista, financiamento ou no cartao de credito?"
5. Troca: "Voce pretende dar um carro na troca?"
6. Agendar test drive: sugerir horarios disponiveis. Confirmar veiculo, data e hora.
7. Encaminhamento: "Perfeito! Vou te encaminhar para o setor comercial dar continuidade no seu atendimento. Qualquer coisa me chama aqui 😊"

Apos encaminhamento, nao faca mais perguntas ou CTA. Apenas encerre de forma sutil.
Se o lead se afastar do assunto, traga de volta sutilmente.`,
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
      images = detectImageRequest(userMessage, reply, session.messages);
    }

    res.json({ reply, ...(images && { images }) });

  } catch (err) {
    console.error(`[chat error] ${agentId}:`, err.message);
    res.status(502).json({ error: 'Nao foi possivel alcancar o modelo de IA. Tente novamente.' });
  }
});

// ══════════════════════════════════════════════════
//  DETECÇÃO DE PEDIDO DE IMAGENS (Imobiliaria)
// ══════════════════════════════════════════════════
const IMAGE_TRIGGERS = /\b(foto|fotos|imagem|imagens|ver|mostr|veja|olha|quero ver|manda|envia|sim|claro|pode|quero|bora|manda ver|show)\b/i;

const PROPERTY_NAME_MAP = {
  'audace':   'REF-101',
  'reboucas': 'REF-101',
  'le monde': 'REF-102',
  'portao':   null, // ambiguo (102 e 103)
  'uno solare': 'REF-103',
  'solare':   'REF-103',
  'jardim':   'REF-104',
  'manacas':  'REF-104',
  'tingui':   'REF-104',
};

function detectImageRequest(userMsg, aiReply, history) {
  const userLower = userMsg.toLowerCase();

  // O usuario precisa ter pedido fotos ou aceitado ver
  const userWantsImages = IMAGE_TRIGGERS.test(userLower);
  if (!userWantsImages) return null;

  // Verificar se a conversa recente menciona fotos/imagens (agente sugeriu?)
  const recentContext = history.slice(-6).map(m => m.content.toLowerCase()).join(' ');
  const photoContext = /foto|imagem|mostr|ver/.test(recentContext);
  if (!photoContext) return null;

  // Detectar qual imovel está sendo discutido (nas ultimas mensagens)
  const contextText = recentContext + ' ' + aiReply.toLowerCase();
  const matchedRefs = new Set();

  for (const [keyword, ref] of Object.entries(PROPERTY_NAME_MAP)) {
    if (ref && contextText.includes(keyword)) {
      matchedRefs.add(ref);
    }
  }

  // Se "portao" aparece sem Le Monde ou Uno Solare, tentar ambos
  if (contextText.includes('portao') && matchedRefs.size === 0) {
    matchedRefs.add('REF-102');
    matchedRefs.add('REF-103');
  }

  if (matchedRefs.size === 0) return null;

  // Montar resposta com imagens dos imoveis detectados
  const result = [];
  for (const ref of matchedRefs) {
    const prop = PROPERTY_IMAGES[ref];
    if (!prop) continue;
    result.push({
      ref,
      name: prop.name,
      images: prop.images.map(img => ({
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

// ══════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n  Secretaria Visual rodando em http://localhost:${PORT}`);
  console.log(`  OpenRouter API: ${OPENROUTER_API_KEY ? '✓ configurada' : '✗ NAO CONFIGURADA — edite .env'}`);
  console.log(`  Mesas: ${tables.length} (${tables.filter(t => t.status === 'occupied').length} ocupadas)`);
  console.log(`  Agendamentos: ${appointments.filter(a => a.status === 'confirmed').length} ativos\n`);
});
