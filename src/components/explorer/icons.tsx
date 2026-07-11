// ─────────────────────────────────────────────────────────────────────────────
// Seli Destination Explorer — icon map
//
// The prototype (kit.jsx) defined a custom `I` set of stroke icons. We map each
// name to its lucide-react-native equivalent (the app's standard icon library,
// per CLAUDE.md) so screen code keeps reading `<Ic.search />` exactly like the
// design references, while rendering true native SVG icons.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Search, Bell, ChevronLeft, ChevronRight, ArrowRight, ArrowUpRight, Star,
  Clock, ShieldCheck, Check, Bookmark, Heart, Users, FileText, Globe, User,
  MapPin, Zap, SlidersHorizontal, MessageCircle, Plus, House, Layers, Calendar,
  Upload, Phone, Award, Briefcase, Languages, TrendingUp, CheckCircle2, Dot,
  Copy, Send, Video, Sparkles, X, HelpCircle, Gauge, Crown,
} from 'lucide-react-native';

// Design-name → lucide component. Stroke width 1.8 matches the prototype default.
export const Ic = {
  search: Search,
  bell: Bell,
  chevL: ChevronLeft,
  chevR: ChevronRight,
  arrow: ArrowRight,
  arrowUR: ArrowUpRight,
  star: Star,
  clock: Clock,
  shield: ShieldCheck,
  check: Check,
  bookmark: Bookmark,
  heart: Heart,
  users: Users,
  docs: FileText,
  globe: Globe,
  user: User,
  pin: MapPin,
  zap: Zap,
  sliders: SlidersHorizontal,
  msg: MessageCircle,
  plus: Plus,
  home: House,
  layers: Layers,
  cal: Calendar,
  upload: Upload,
  phone: Phone,
  award: Award,
  brief: Briefcase,
  lang: Languages,
  trend: TrendingUp,
  check2: CheckCircle2,
  dot: Dot,
  cards: Copy,
  send: Send,
  video: Video,
  spark: Sparkles,
  x: X,
  help: HelpCircle,
  gauge: Gauge,
  crown: Crown,
} as const;

export type IcName = keyof typeof Ic;

// Default stroke width used throughout the Explorer (matches prototype's 1.8).
export const IC_STROKE = 1.8;
