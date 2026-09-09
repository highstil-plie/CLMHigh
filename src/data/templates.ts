import type { Clause, Template } from '../types'

export const USERS = {
  douglas: 'u_douglas',
  alice: 'u_alice',
  gabriela: 'u_gabriela',
  andre: 'u_andre',
  dora: 'u_dora',
  donizete: 'u_donizete',
} as const

const T0 = '2024-01-15T12:00:00.000Z'

export const CLAUSES: Clause[] = [
  {
    id: 'cl_sla',
    title: 'Nível de Serviço (SLA)',
    category: 'Operacional',
    approved: true,
    updatedAt: T0,
    body:
      'A {{company.name}} garantirá disponibilidade mínima de 99,5% (noventa e nove vírgula cinco por cento) das Soluções, apurada mensalmente, excluídas as janelas de manutenção programada comunicadas com antecedência mínima de 48 (quarenta e oito) horas. O descumprimento do SLA ensejará crédito de 5% (cinco por cento) sobre a mensalidade para cada ponto percentual abaixo da meta, limitado a 30% (trinta por cento).',
  },
  {
    id: 'cl_lgpd',
    title: 'Proteção de Dados (LGPD)',
    category: 'Jurídico',
    approved: true,
    updatedAt: T0,
    body:
      'As Partes obrigam-se a cumprir a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais) e demais normas aplicáveis, atuando a {{company.name}} como operadora e o Cliente como controlador dos dados pessoais tratados no âmbito deste Acordo. A {{company.name}} adotará medidas técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas.',
  },
  {
    id: 'cl_reajuste',
    title: 'Reajuste Anual',
    category: 'Financeiro',
    approved: true,
    updatedAt: T0,
    body:
      'Os valores previstos neste Acordo serão reajustados anualmente, na data de aniversário do contrato, pela variação positiva acumulada do IPCA/IBGE nos 12 (doze) meses anteriores ou, na sua extinção, pelo índice que vier a substituí-lo.',
  },
  {
    id: 'cl_exclusividade',
    title: 'Exclusividade',
    category: 'Comercial',
    approved: false,
    updatedAt: T0,
    body:
      'Durante a vigência deste Acordo, o Cliente compromete-se a não contratar de terceiros serviços de natureza idêntica ou similar aos aqui previstos, sob pena de multa equivalente a 20% (vinte por cento) do valor total do contrato.',
  },
  {
    id: 'cl_multa',
    title: 'Multa por Rescisão Antecipada',
    category: 'Financeiro',
    approved: true,
    updatedAt: T0,
    body:
      'Em caso de rescisão imotivada por qualquer das Partes antes do término do prazo contratual, a Parte que der causa pagará à outra multa compensatória equivalente a 3 (três) mensalidades, sem prejuízo dos valores devidos pelos serviços já prestados.',
  },
  {
    id: 'cl_auditoria',
    title: 'Direito de Auditoria',
    category: 'Jurídico',
    approved: true,
    updatedAt: T0,
    body:
      'O Cliente poderá, mediante aviso prévio de 15 (quinze) dias e no máximo uma vez a cada 12 (doze) meses, auditar os controles de segurança da {{company.name}} relativos aos serviços prestados, diretamente ou por meio de auditor independente sujeito a obrigação de confidencialidade.',
  },
  {
    id: 'cl_anticorrupcao',
    title: 'Anticorrupção',
    category: 'Compliance',
    approved: true,
    updatedAt: T0,
    body:
      'As Partes declaram conhecer e comprometem-se a cumprir a Lei nº 12.846/2013 e demais normas anticorrupção aplicáveis, abstendo-se de praticar quaisquer atos lesivos à administração pública nacional ou estrangeira.',
  },
  {
    id: 'cl_seguro',
    title: 'Seguro de Responsabilidade Civil',
    category: 'Operacional',
    approved: false,
    updatedAt: T0,
    body:
      'A {{company.name}} manterá, durante toda a vigência deste Acordo, seguro de responsabilidade civil profissional com cobertura mínima de R$ 1.000.000,00 (um milhão de reais), apresentando a respectiva apólice sempre que solicitado pelo Cliente.',
  },
]

export const TEMPLATE_MSA: Template = {
  id: 'tpl_msa',
  name: 'Contrato Principal de Serviços (MSA)',
  abbr: 'MSA',
  type: 'Acordo Principal de Serviço',
  description: 'Template do fluxo Contrato Principal de Serviço',
  ownerId: USERS.andre,
  createdAt: T0,
  updatedAt: '2024-11-26T13:44:00.000Z',
  sections: [
    { id: 'cliente', title: 'Cliente' },
    { id: 'cliente_existente', title: 'Selecionar Cliente', indent: true, showIf: { field: 'clientType', op: 'eq', value: 'Cliente Existente' } },
    { id: 'dados_cliente', title: 'Dados do Cliente', indent: true, showIf: { field: 'clientType', op: 'eq', value: 'Cliente Novo' } },
    { id: 'contrato', title: 'Dados do Contrato' },
    {
      id: 'termos',
      title: 'Termos do Contrato',
      indent: true,
      description: 'Contratos customizados serão enviados para validação prévia do Jurídico',
      showIf: { field: 'config', op: 'eq', value: 'Customizado' },
    },
    { id: 'adicionais', title: 'Termos Adicionais', indent: true },
    { id: 'servicos', title: 'Serviços' },
  ],
  fields: [
    { id: 'clientType', sectionId: 'cliente', label: 'Tipo de Cliente', type: 'radio', required: true, options: ['Cliente Existente', 'Cliente Novo'], default: 'Cliente Novo' },
    { id: 'existingParty', sectionId: 'cliente_existente', label: 'Cliente', type: 'party', required: true },
    { id: 'name', sectionId: 'dados_cliente', label: 'Nome', type: 'text', required: true },
    { id: 'cnpj', sectionId: 'dados_cliente', label: 'CNPJ', type: 'text', required: true, placeholder: '00.000.000/0000-00' },
    { id: 'address', sectionId: 'dados_cliente', label: 'Endereço', type: 'text', required: true },
    { id: 'city', sectionId: 'dados_cliente', label: 'Cidade', type: 'text', required: true },
    { id: 'state', sectionId: 'dados_cliente', label: 'Estado', type: 'text', required: true, placeholder: 'UF' },
    { id: 'zip', sectionId: 'dados_cliente', label: 'CEP', type: 'text', required: true, placeholder: '00000-000' },
    { id: 'startDate', sectionId: 'contrato', label: 'Data de Início', type: 'date', required: true, helpText: 'Data em que o contrato entra em vigor.' },
    { id: 'config', sectionId: 'contrato', label: 'Configuração do Contrato', type: 'radio', required: true, options: ['Pré-aprovado', 'Customizado'], default: 'Pré-aprovado' },
    { id: 'termMonths', sectionId: 'termos', label: 'Prazo Contratual (meses)', type: 'select', required: true, options: ['12', '24', '36', '48', '60'], default: '36' },
    { id: 'paymentNet', sectionId: 'termos', label: 'Prazo para Pagamento (NET)', type: 'select', required: true, options: ['30', '45', '60', '90'], default: '30' },
    { id: 'terminationNotice', sectionId: 'termos', label: 'Aviso de Rescisão (dias)', type: 'select', required: true, options: ['30', '60', '90'], default: '60' },
    { id: 'customizeClauses', sectionId: 'adicionais', label: 'Customizar Cláusulas', type: 'checkbox', default: false },
    { id: 'clauses', sectionId: 'adicionais', label: 'Cláusulas da biblioteca', type: 'clauses', showIf: { field: 'customizeClauses', op: 'truthy' } },
    {
      id: 'value',
      sectionId: 'servicos',
      label: 'Valor do Contrato',
      type: 'currency',
      required: true,
      placeholder: '0.00',
      hint: 'Requer aprovação da Diretoria para contratos acima de R$ 100.000',
      warnIf: { when: { field: 'value', op: 'gt', value: 100000 }, text: 'Este contrato será encaminhado para Aprovação Executiva.' },
    },
    { id: 'services', sectionId: 'servicos', label: 'Defina quais serviços serão prestados', type: 'checkbox-group', options: ['Serviços de TI Gerenciados', 'Serviços em Nuvem', 'Cibersegurança'] },
    { id: 'includeNDA', sectionId: 'servicos', label: 'Incluir NDA', type: 'checkbox', default: false },
    { id: 'attachments', sectionId: 'servicos', label: 'Anexar Documentos', type: 'file' },
  ],
  content: [
    { kind: 'title', text: 'Contrato Principal de Serviços' },
    {
      kind: 'p',
      text:
        'Este CONTRATO PRINCIPAL DE SERVIÇOS, juntamente com quaisquer anexos, pedidos, SOWs e outros documentos expressamente firmados entre as Partes referenciando este Contrato Principal de Serviços (coletivamente, este "Acordo"), entra em vigor a partir de {{startDate}} ("Data de Início") entre {{company.legalName}} ("{{company.name}}"), CNPJ {{company.cnpj}}, uma corporação com sede principal em {{company.address}}, {{company.city}}, {{company.state}}, {{company.zip}}, e {{party.name}} ("Cliente"), CNPJ {{party.cnpj}}, com sede principal em {{party.address}}, {{party.city}}, {{party.state}}, {{party.zip}}. {{company.name}} e Cliente podem ser referidos aqui individualmente como uma "Parte" e coletivamente como as "Partes". {{company.name}} e Cliente concordam com o exposto e conforme segue:',
    },
    { kind: 'h2', text: '1. Visão Geral.' },
    {
      kind: 'p',
      text:
        '1.1 Escopo. Este Acordo estabelece os termos pelos quais o Cliente pode adquirir e a {{company.name}} pode fornecer licenças de assinatura ("Assinaturas") para as aplicações e soluções de software online e baseadas na web não proprietárias da {{company.name}} ("Soluções") e diversos serviços profissionais de implementação, configuração e outros relacionados às Soluções ("Serviços Profissionais" ou "PS").',
    },
    {
      kind: 'p',
      text:
        '1.2 Pedidos. Cliente e {{company.name}} podem, ocasionalmente, executar: (a) um Formulário de Pedido de Cliente {{company.name}} ("Pedido") para qualquer uma das Soluções; e/ou (b) uma Declaração de Trabalho ("SOW") para PS relacionado às Soluções. Cada Pedido descreverá a Solução aplicável, o Prazo do Pedido (conforme definido na Seção 7.1), taxas relacionadas, detalhes do usuário e quaisquer limitações de Assinatura. Cada SOW descreverá o PS a ser fornecido pela {{company.name}}, quaisquer obrigações do Cliente e as taxas relacionadas. Cada Pedido e SOW acordado pelas Partes fará referência e estará sujeito aos termos deste Acordo e pode conter termos adicionais aplicáveis a uma Solução específica. O Pedido inicial será anexado a este Acordo como Anexo A e um SOW, se aplicável, será anexado a este Acordo como Anexo B.',
    },
    {
      kind: 'p',
      text:
        '1.3 Foro de Eleição. Este Acordo será regido e interpretado de acordo com as leis substantivas do Brasil. As partes elegem, de forma irrevogável e irretratável, o foro da Comarca de {{company.city}} ({{company.state}}), como o único competente para dirimir quaisquer controvérsias oriundas deste Acordo, independentemente de qualquer outro por mais privilegiado que seja ou venha a ser.',
    },
    {
      kind: 'p',
      text:
        '1.4 Fonte de Referência. A {{company.name}} pode publicar os logotipos do Cliente no site da {{company.name}} e referir-se ao Cliente como um Cliente da {{company.name}} em materiais online e impressos. A {{company.name}} pode, com a aprovação prévia do Cliente, que não será injustificadamente retida, identificar o Cliente como uma referência para a {{company.name}} e direcionar potenciais clientes a entrar em contato diretamente com o Cliente sobre os produtos e serviços da {{company.name}}.',
    },
    {
      kind: 'p',
      text:
        '1.5 Aviso de Rescisão. Qualquer das Partes pode rescindir este Acordo, ou qualquer Pedido ou SOW específico, imediatamente e sem penalidade ao fornecer aviso por escrito à outra Parte se a outra Parte violar qualquer termo ou condição material deste Acordo ou de tal Pedido ou SOW e, se tal violação for passível de correção, não corrigir tal violação dentro de {{terminationNotice}} dias após ser notificada pela Parte não infratora com aviso por escrito descrevendo a violação em detalhes razoáveis. Além disso, qualquer das Partes pode rescindir este Acordo ao fornecer {{terminationNotice}} ({{terminationNoticeWords}}) dias de aviso prévio por escrito à outra Parte se não houver Pedidos ou SOWs pendentes em vigor sob este Acordo.',
    },
    {
      kind: 'p',
      text:
        '1.6 Força Maior. Exceto pelas obrigações de pagamento aqui estabelecidas, nenhuma das Partes será responsável ou considerada em falta por qualquer atraso ou falha no desempenho aqui estabelecido na medida em que resultar de causas além do controle razoável da Parte, incluindo atos ou omissões de terceiros, atos ou omissões da outra Parte ou qualquer atraso ou falha da outra Parte em cumprir suas obrigações aqui estabelecidas, atos de Deus, terrorismo, guerra, insurreição civil, greves ou outras interrupções de trabalho organizado, comunicações, Internet, interrupções ou falhas mecânicas, eletrônicas ou de outros serviços públicos, incêndios, explosões, inundações ou outros desastres.',
    },
    { kind: 'h2', text: '2. Serviços Contratados.' },
    {
      kind: 'p',
      text:
        '2.1 Objeto. A {{company.name}} prestará ao Cliente os seguintes serviços: {{services}}. Os serviços serão executados de acordo com as melhores práticas de mercado e com a legislação aplicável.',
      showIf: { field: 'services', op: 'truthy' },
    },
    {
      kind: 'p',
      text: '2.1 Objeto. Os serviços a serem prestados pela {{company.name}} serão detalhados em Pedidos e SOWs específicos firmados pelas Partes nos termos da Seção 1.2.',
      showIf: { field: 'services', op: 'falsy' },
    },
    { kind: 'h2', text: '3. Preço e Condições de Pagamento.' },
    {
      kind: 'p',
      text:
        '3.1 Valor. Pelos serviços objeto deste Acordo o Cliente pagará à {{company.name}} o valor total de {{value}} ({{valueWords}}), conforme cronograma de faturamento previsto nos Pedidos e SOWs aplicáveis.',
    },
    {
      kind: 'p',
      text:
        '3.2 Prazo de Pagamento. As faturas serão emitidas mensalmente e deverão ser pagas em até {{paymentNet}} (NET {{paymentNet}}) dias contados da data de emissão. Valores pagos em atraso sofrerão acréscimo de multa de 2% (dois por cento) e juros de mora de 1% (um por cento) ao mês, pro rata die.',
    },
    { kind: 'h2', text: '4. Prazo e Vigência.' },
    {
      kind: 'p',
      text:
        '4.1 Este Acordo vigorará pelo prazo de {{termMonths}} ({{termMonthsWords}}) meses a contar da Data de Início, encerrando-se em {{endDate}}, renovando-se automaticamente por períodos sucessivos de 12 (doze) meses, salvo manifestação em contrário de qualquer das Partes com antecedência mínima de {{terminationNotice}} dias do término.',
    },
    { kind: 'h2', text: '5. Confidencialidade.', showIf: { field: 'includeNDA', op: 'truthy' } },
    {
      kind: 'p',
      showIf: { field: 'includeNDA', op: 'truthy' },
      text:
        '5.1 As Partes obrigam-se a manter em sigilo todas as Informações Confidenciais a que tiverem acesso em razão deste Acordo, utilizando-as exclusivamente para os fins aqui previstos, pelo prazo de vigência do Acordo e por 5 (cinco) anos após seu término. Esta obrigação incorpora integralmente os termos do Acordo de Não-Divulgação (NDA) firmado entre as Partes, que passa a integrar este Acordo como Anexo C.',
    },
    { kind: 'h2', text: '6. Disposições Adicionais.', showIf: { field: 'clauses', op: 'truthy' } },
    { kind: 'clauses', showIf: { field: 'clauses', op: 'truthy' } },
    { kind: 'signature' },
  ],
  rules: [
    {
      id: 'rule_juridico',
      name: 'Revisão Jurídica para contratos customizados',
      description: 'Quando a configuração do contrato for "Customizado", encaminhar para validação prévia do Jurídico.',
      when: { field: 'config', op: 'eq', value: 'Customizado' },
      addStep: 'Revisão Jurídica',
      approverId: USERS.alice,
      enabled: true,
    },
    {
      id: 'rule_clausulas',
      name: 'Revisão Jurídica para cláusulas customizadas',
      description: 'Quando cláusulas adicionais forem incluídas, o Jurídico deve revisar o documento.',
      when: { field: 'clauses', op: 'truthy' },
      addStep: 'Revisão Jurídica',
      approverId: USERS.alice,
      enabled: true,
    },
    {
      id: 'rule_financeiro',
      name: 'Revisão Financeira acima de R$ 50.000',
      description: 'Contratos com valor a partir de R$ 50.000 passam por revisão do Financeiro.',
      when: { field: 'value', op: 'gte', value: 50000 },
      addStep: 'Revisão Financeira',
      approverId: USERS.gabriela,
      enabled: true,
    },
    {
      id: 'rule_diretoria',
      name: 'Aprovação da Diretoria acima de R$ 100.000',
      description: 'Contratos com valor acima de R$ 100.000 exigem Aprovação Executiva.',
      when: { field: 'value', op: 'gt', value: 100000 },
      addStep: 'Aprovação Executiva',
      approverId: USERS.andre,
      enabled: true,
    },
  ],
}

export const TEMPLATE_NDA: Template = {
  id: 'tpl_nda',
  name: 'Acordo de Não-Divulgação (NDA)',
  abbr: 'NDA',
  type: 'Acordo de Confidencialidade',
  description: 'Template do fluxo de Acordo de Confidencialidade',
  ownerId: USERS.alice,
  createdAt: T0,
  updatedAt: '2024-10-02T10:00:00.000Z',
  sections: [
    { id: 'parte', title: 'Parte' },
    { id: 'dados_parte', title: 'Dados da Parte', indent: true, showIf: { field: 'clientType', op: 'eq', value: 'Parte Nova' } },
    { id: 'parte_existente', title: 'Selecionar Parte', indent: true, showIf: { field: 'clientType', op: 'eq', value: 'Parte Existente' } },
    { id: 'termos', title: 'Termos do Acordo' },
  ],
  fields: [
    { id: 'clientType', sectionId: 'parte', label: 'Tipo de Parte', type: 'radio', required: true, options: ['Parte Existente', 'Parte Nova'], default: 'Parte Existente' },
    { id: 'existingParty', sectionId: 'parte_existente', label: 'Parte', type: 'party', required: true },
    { id: 'name', sectionId: 'dados_parte', label: 'Razão Social', type: 'text', required: true },
    { id: 'cnpj', sectionId: 'dados_parte', label: 'CNPJ', type: 'text', required: true },
    { id: 'address', sectionId: 'dados_parte', label: 'Endereço', type: 'text', required: true },
    { id: 'city', sectionId: 'dados_parte', label: 'Cidade', type: 'text', required: true },
    { id: 'state', sectionId: 'dados_parte', label: 'Estado', type: 'text', required: true },
    { id: 'zip', sectionId: 'dados_parte', label: 'CEP', type: 'text', required: true },
    { id: 'startDate', sectionId: 'termos', label: 'Data de Início', type: 'date', required: true },
    { id: 'ndaType', sectionId: 'termos', label: 'Tipo de NDA', type: 'radio', required: true, options: ['Mútuo', 'Unilateral'], default: 'Mútuo' },
    { id: 'purpose', sectionId: 'termos', label: 'Finalidade', type: 'textarea', required: true, placeholder: 'Ex.: avaliação de parceria comercial para serviços em nuvem' },
    { id: 'termMonths', sectionId: 'termos', label: 'Prazo de Confidencialidade (meses)', type: 'select', required: true, options: ['12', '24', '36', '60'], default: '24' },
    {
      id: 'penalty',
      sectionId: 'termos',
      label: 'Multa por descumprimento (R$)',
      type: 'currency',
      required: true,
      default: 50000,
      hint: 'Multas acima de R$ 200.000 exigem revisão do Jurídico',
    },
  ],
  content: [
    { kind: 'title', text: 'Acordo de Não-Divulgação' },
    {
      kind: 'p',
      text:
        'Este ACORDO DE NÃO-DIVULGAÇÃO ("Acordo") é celebrado em {{startDate}} entre {{company.legalName}}, CNPJ {{company.cnpj}}, com sede em {{company.address}}, {{company.city}}, {{company.state}} ("{{company.name}}") e {{party.name}}, CNPJ {{party.cnpj}}, com sede em {{party.address}}, {{party.city}}, {{party.state}} ("Parte Receptora"), em conjunto denominadas "Partes".',
    },
    { kind: 'h2', text: '1. Finalidade.' },
    { kind: 'p', text: '1.1 As Partes pretendem trocar Informações Confidenciais com a seguinte finalidade: {{purpose}} ("Finalidade").' },
    { kind: 'h2', text: '2. Natureza do Acordo.' },
    { kind: 'p', text: '2.1 Este Acordo é de natureza {{ndaTypeLower}}, obrigando {{ndaScope}} ao dever de sigilo aqui previsto.' },
    { kind: 'h2', text: '3. Obrigações de Confidencialidade.' },
    {
      kind: 'p',
      text:
        '3.1 A Parte Receptora compromete-se a manter as Informações Confidenciais em estrito sigilo, a utilizá-las exclusivamente para a Finalidade, a restringir o acesso aos seus empregados e consultores que necessitem conhecê-las e a não divulgá-las a terceiros sem consentimento prévio e por escrito da Parte Reveladora.',
    },
    { kind: 'h2', text: '4. Prazo.' },
    { kind: 'p', text: '4.1 As obrigações previstas neste Acordo vigorarão pelo prazo de {{termMonths}} ({{termMonthsWords}}) meses contados da data de sua assinatura, encerrando-se em {{endDate}}.' },
    { kind: 'h2', text: '5. Penalidades.' },
    {
      kind: 'p',
      text:
        '5.1 O descumprimento de qualquer obrigação deste Acordo sujeitará a Parte infratora ao pagamento de multa não compensatória no valor de {{value}} ({{valueWords}}), sem prejuízo da indenização pelas perdas e danos efetivamente comprovados.',
    },
    { kind: 'h2', text: '6. Foro.' },
    { kind: 'p', text: '6.1 Fica eleito o foro da Comarca de {{company.city}} ({{company.state}}) para dirimir quaisquer controvérsias oriundas deste Acordo.' },
    { kind: 'signature' },
  ],
  rules: [
    {
      id: 'rule_nda_multa',
      name: 'Revisão Jurídica para multa elevada',
      description: 'NDAs com multa acima de R$ 200.000 exigem revisão do Jurídico.',
      when: { field: 'value', op: 'gt', value: 200000 },
      addStep: 'Revisão Jurídica',
      approverId: USERS.alice,
      enabled: true,
    },
    {
      id: 'rule_nda_unilateral',
      name: 'Revisão Jurídica para NDA unilateral',
      description: 'NDAs unilaterais exigem revisão do Jurídico.',
      when: { field: 'ndaType', op: 'eq', value: 'Unilateral' },
      addStep: 'Revisão Jurídica',
      approverId: USERS.alice,
      enabled: true,
    },
  ],
}

export const TEMPLATE_UPLOAD: Template = {
  id: 'tpl_upload',
  name: 'Upload de Contrato de Terceiros',
  abbr: 'Terceiros',
  type: 'Acordo de Serviços',
  description: 'Cadastro de contrato redigido pela contraparte',
  isUpload: true,
  ownerId: USERS.douglas,
  createdAt: T0,
  updatedAt: '2024-09-10T10:00:00.000Z',
  sections: [
    { id: 'documento', title: 'Documento' },
    { id: 'parte', title: 'Parte' },
    { id: 'parte_existente', title: 'Selecionar Parte', indent: true, showIf: { field: 'clientType', op: 'eq', value: 'Parte Existente' } },
    { id: 'dados_parte', title: 'Dados da Parte', indent: true, showIf: { field: 'clientType', op: 'eq', value: 'Parte Nova' } },
    { id: 'termos', title: 'Dados do Contrato' },
  ],
  fields: [
    { id: 'docName', sectionId: 'documento', label: 'Nome do documento', type: 'text', required: true },
    { id: 'docType', sectionId: 'documento', label: 'Tipo de acordo', type: 'select', required: true, options: ['Acordo de Serviços', 'Ordem de Compra', 'Declaração de Trabalho', 'Contrato de Locação', 'Adendo', 'Emenda', 'Formulário de Pedido'], default: 'Acordo de Serviços' },
    { id: 'attachments', sectionId: 'documento', label: 'Arquivo do contrato', type: 'file', required: true },
    { id: 'clientType', sectionId: 'parte', label: 'Tipo de Parte', type: 'radio', required: true, options: ['Parte Existente', 'Parte Nova'], default: 'Parte Existente' },
    { id: 'existingParty', sectionId: 'parte_existente', label: 'Parte', type: 'party', required: true },
    { id: 'name', sectionId: 'dados_parte', label: 'Razão Social', type: 'text', required: true },
    { id: 'cnpj', sectionId: 'dados_parte', label: 'CNPJ', type: 'text', required: true },
    { id: 'address', sectionId: 'dados_parte', label: 'Endereço', type: 'text', required: true },
    { id: 'city', sectionId: 'dados_parte', label: 'Cidade', type: 'text', required: true },
    { id: 'state', sectionId: 'dados_parte', label: 'Estado', type: 'text', required: true },
    { id: 'zip', sectionId: 'dados_parte', label: 'CEP', type: 'text', required: true },
    { id: 'startDate', sectionId: 'termos', label: 'Data de Início', type: 'date', required: true },
    { id: 'termMonths', sectionId: 'termos', label: 'Prazo (meses)', type: 'select', required: true, options: ['6', '12', '24', '36', '48', '60'], default: '12' },
    { id: 'value', sectionId: 'termos', label: 'Valor do Contrato', type: 'currency', required: true, hint: 'Contratos de terceiros são sempre revisados pelo Jurídico' },
    { id: 'notes', sectionId: 'termos', label: 'Observações', type: 'textarea' },
  ],
  content: [
    { kind: 'title', text: '{{docName}}' },
    { kind: 'p', text: 'Documento externo redigido por {{party.name}} (CNPJ {{party.cnpj}}) e cadastrado no repositório em {{today}} por {{owner}}.' },
    { kind: 'p', text: 'Tipo de acordo: {{docType}}. Vigência: {{startDate}} a {{endDate}} ({{termMonths}} meses). Valor: {{value}}.' },
    { kind: 'p', text: 'Observações: {{notes}}', showIf: { field: 'notes', op: 'truthy' } },
    { kind: 'p', text: 'Arquivo(s) anexado(s): {{attachments}}.' },
  ],
  rules: [
    {
      id: 'rule_upload_juridico',
      name: 'Revisão Jurídica obrigatória',
      description: 'Todo contrato de terceiros passa por revisão do Jurídico.',
      when: { field: 'docName', op: 'truthy' },
      addStep: 'Revisão Jurídica',
      approverId: USERS.alice,
      enabled: true,
    },
    {
      id: 'rule_upload_financeiro',
      name: 'Revisão Financeira acima de R$ 50.000',
      description: 'Contratos com valor a partir de R$ 50.000 passam por revisão do Financeiro.',
      when: { field: 'value', op: 'gte', value: 50000 },
      addStep: 'Revisão Financeira',
      approverId: USERS.gabriela,
      enabled: true,
    },
  ],
}

export const TEMPLATES: Template[] = [TEMPLATE_MSA, TEMPLATE_NDA, TEMPLATE_UPLOAD]
