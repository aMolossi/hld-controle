export type Tamanho = "P" | "M" | "G";

export interface Produto {
  id: number;
  tamanho: string;
  nome: string;
  preco: number;
  custo: number;
  ativo: number;
  ordem: number;
}

export interface Venda {
  id: number;
  data: string;
  cliente_nome: string | null;
  telefone: string | null;
  bairro: string | null;
  origem: string | null;
  tipo_cliente: string | null;
  tipo_venda: string; // "Avulso" | "Empresa"
  empresa: string | null;
  periodicidade: string | null; // "Semanal" | "Mensal" (contrato empresa)
  tamanho: string; // legado (resumo de compatibilidade)
  valor_marmita: number; // soma dos subtotais das marmitas do pedido
  valor_extras: number;
  total: number;
  qtd_marmitas: number;
  itens_resumo: string | null;
  obs: string | null;
  criado_em: string;
}

export interface VendaItem {
  id: number;
  venda_id: number;
  tamanho: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export interface VendaExtra {
  id: number;
  venda_id: number;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  valor: number; // subtotal da linha (preco_unitario * quantidade)
}

export interface Despesa {
  id: number;
  data: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  tipo: string;
  recorrente: number;
  criado_em: string;
}

export interface DespesaCategoria {
  id: number;
  nome: string;
  tipo: string;
  ordem: number;
}

export interface Lead {
  id: number;
  data: string;
  nome: string | null;
  telefone: string | null;
  bairro: string | null;
  origem: string | null;
  motivo: string | null;
}

// Origens (espelham a planilha HLD). Editaveis no futuro.
export const ORIGENS = [
  "Meta Ads",
  "Instagram",
  "Facebook",
  "Google",
  "WhatsApp Direto",
  "Cliente Antigo",
  "Indicacao",
] as const;

export const TIPOS_CLIENTE = ["Novo", "Recorrente"] as const;

export const TIPOS_VENDA = ["Avulso", "Empresa"] as const;

export const PERIODICIDADES = ["Semanal", "Mensal"] as const;

// Bairros de Sinop-MT (espelham a aba Listas da planilha HLD).
export const BAIRROS = [
  "Centro",
  "Jardim Jacarandás",
  "Jardim Violetas",
  "Jardim Primavera",
  "Jardim Botânico",
  "Jardim Maringá",
  "Jardim Imperial",
  "Jardim Palmeiras",
  "Jardim Paraíso",
  "Jardim Santa Mônica",
  "Jardim Celeste",
  "Jardim das Itaúbas",
  "Jardim dos Ipês",
  "Jardim dos Tarumãs",
  "Residencial Canadá",
  "Cidade Jardim",
  "Parque das Araras",
  "São Cristóvão",
  "Aquarela Brasil",
  "Belvedere",
  "Jardim Gramado",
  "Jardim América",
  "Alto Glória",
  "Camping Club",
  "Outro",
] as const;
