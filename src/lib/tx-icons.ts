import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Bus,
  Coffee,
  Heart,
  Home,
  PiggyBank,
  ShoppingBag,
  Smartphone,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';

export function iconForCategory(name?: string | null, type?: 'income' | 'expense' | 'transfer'): LucideIcon {
  if (type === 'income') return ArrowDownLeft;
  if (type === 'transfer') return ArrowLeftRight;
  const n = (name ?? '').toLowerCase();
  if (/salaire|paye|revenu|vente/.test(n)) return Banknote;
  if (/transport|taxi|bus|essence|carburant/.test(n)) return Bus;
  if (/resto|restaurant|nourriture|marché|aliment|courses/.test(n)) return Utensils;
  if (/café|cafe|boisson/.test(n)) return Coffee;
  if (/loyer|maison|logement/.test(n)) return Home;
  if (/santé|sante|médic|medic/.test(n)) return Heart;
  if (/télé|tele|mobile|airtime|forfait/.test(n)) return Smartphone;
  if (/électricité|electricite|eau|facture/.test(n)) return Zap;
  if (/épargne|epargne|objectif/.test(n)) return PiggyBank;
  if (/shopping|vêt|vetement|habit/.test(n)) return ShoppingBag;
  if (type === 'expense') return ArrowUpRight;
  return Wallet;
}

export function toneForType(type?: 'income' | 'expense' | 'transfer') {
  if (type === 'income') return 'success' as const;
  if (type === 'expense') return 'danger' as const;
  return 'primary' as const;
}
