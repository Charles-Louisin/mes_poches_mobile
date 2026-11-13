import { useAuth } from '@/contexts/auth';
import {
    getSetupStep,
    getTrialOfferSeen,
    setSetupStep,
    setTrialOfferSeen,
    subscribeSetup,
    type TutorialStep,
} from '@/lib/setupGuide';
import { router, usePathname } from 'expo-router';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

export type TargetRect = { x: number; y: number; width: number; height: number };

export type StepMode = 'tap' | 'input' | 'next' | 'modal';

export type StepMeta = {
  id: Exclude<TutorialStep, null | 'done'>;
  target?: string;
  title: string;
  body: string;
  mode: StepMode;
  cta?: string;
  route?: string;
};

export const TUTORIAL_STEPS: StepMeta[] = [
  {
    id: 'pocket-tab',
    target: 'tab-wallets',
    title: 'On commence par vos poches',
    body: 'Une poche = un compte réel : cash, Orange Money, MTN, banque. Appuyez sur Poches pour créer la première.',
    mode: 'tap',
  },
  {
    id: 'pocket-page',
    title: 'Voici la page pour ajouter une poche',
    body: 'Indiquez le nom et le solde actuel, puis créez la poche. Vous pouvez aussi continuer la visite et revenir plus tard.',
    mode: 'next',
    cta: 'Continuer',
    route: '/(tabs)/wallets/new',
  },
  {
    id: 'category-tab',
    target: 'tab-categories',
    title: 'Les catégories, maintenant',
    body: 'Elles classent vos mouvements : transport, marché, salaire… Appuyez sur Catégories pour ouvrir la page d’ajout.',
    mode: 'tap',
    route: '/(tabs)/categories',
  },
  {
    id: 'category-page',
    title: 'Voici la page pour ajouter une catégorie',
    body: 'Choisissez Sortie ou Entrée, donnez un nom, puis créez la catégorie. Vous pouvez aussi continuer la visite.',
    mode: 'next',
    cta: 'Continuer',
  },
  {
    id: 'tour-home',
    target: 'tab-home',
    title: 'L’accueil, votre tableau de bord',
    body: 'Solde total, vos poches, les quatre actions du quotidien (dépense, revenu, scan, virement) et vos dernières transactions.',
    mode: 'next',
    cta: 'On continue',
    route: '/(tabs)',
  },
  {
    id: 'tour-transactions',
    target: 'tab-transactions',
    title: 'L’historique de vos mouvements',
    body: 'Toutes vos transactions et dépenses prévues. Filtrez par poche, catégorie ou mois ; touchez une ligne pour la corriger.',
    mode: 'next',
    cta: 'On continue',
    route: '/(tabs)/transactions',
  },
  {
    id: 'tour-wallets',
    target: 'tab-wallets',
    title: 'Vos poches, une par une',
    body: 'Vos comptes et leur solde. Créez une poche par source d’argent.',
    mode: 'next',
    cta: 'On continue',
    route: '/(tabs)/wallets',
  },
  {
    id: 'tour-analytics',
    target: 'tab-analytics',
    title: 'Comprendre le mois',
    body: 'Entrées, sorties et répartition par catégorie, mois par mois. Les analyses détaillées font partie des forfaits payants.',
    mode: 'next',
    cta: 'On continue',
    route: '/(tabs)/analytics',
  },
  {
    id: 'tour-plus',
    target: 'tab-plus',
    title: 'Le reste de l’app, au même endroit',
    body: 'Objectifs (budgets, épargne, récurrences), transactions à valider, réglages et export.',
    mode: 'next',
    cta: 'On continue',
    route: '/(tabs)/plus',
  },
  {
    id: 'tour-feedback',
    target: 'settings-feedback',
    title: 'Un mot pour nous, ici',
    body: 'Un bug, une idée, une question : écrivez-nous ici. Nous répondons dans l’app.',
    mode: 'next',
    cta: 'C’est noté',
    route: '/settings',
  },
  {
    id: 'success',
    title: 'Vous êtes prêt',
    body: 'Vous avez une poche et une catégorie. Ajoutez votre première dépense avec le bouton + en bas.',
    mode: 'modal',
    cta: 'C’est parti',
  },
  {
    id: 'trial',
    title: 'Un mois Premium, offert',
    body: 'Pendant 30 jours, scan de tickets, dictée, exports, budgets et objectifs sont débloqués.',
    mode: 'modal',
    cta: 'Compris',
  },
];

type TutorialContextValue = {
  step: TutorialStep;
  meta: StepMeta | null;
  active: boolean;
  rects: Record<string, TargetRect>;
  register: (id: string, rect: TargetRect | null) => void;
  next: () => void;
  skip: () => void;
  afterPocketCreated: () => void;
  afterCategoryCreated: () => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

function nextId(current: TutorialStep): TutorialStep {
  const i = TUTORIAL_STEPS.findIndex((s) => s.id === current);
  if (i < 0 || i >= TUTORIAL_STEPS.length - 1) return 'done';
  return TUTORIAL_STEPS[i + 1].id;
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<TutorialStep>(null);
  const [rects, setRects] = useState<Record<string, TargetRect>>({});
  const pathname = usePathname();
  const ready = useRef(false);
  const { ready: authReady, user } = useAuth();
  const userId = user?.id;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    if (!authReady) return;
    const seq = ++loadSeq.current;
    const stored = await getSetupStep(userIdRef.current);
    if (seq !== loadSeq.current) return;
    setStep(stored);
    ready.current = true;
  }, [authReady]);

  useEffect(() => {
    void load();
    return subscribeSetup(() => {
      void load();
    });
  }, [load, userId]);

  const persist = useCallback(
    (next: TutorialStep) => {
      setStep(next);
      if (userId) void setSetupStep(userId, next);
    },
    [userId]
  );

  const go = useCallback(
    (next: TutorialStep) => {
      persist(next);
      const meta = TUTORIAL_STEPS.find((s) => s.id === next);
      if (meta?.route) router.navigate(meta.route as never);
    },
    [persist]
  );

  const next = useCallback(() => {
    const n = nextId(step);
    if (n === 'done') {
      persist('done');
      return;
    }
    if (n === 'trial') {
      void (async () => {
        const seen = await getTrialOfferSeen(userId);
        if (seen) persist('done');
        else go('trial');
      })();
      return;
    }
    go(n);
  }, [go, persist, step, userId]);

  const skip = useCallback(() => {
    void (async () => {
      const seen = await getTrialOfferSeen(userId);
      if (seen) persist('done');
      else go('trial');
    })();
  }, [go, persist, userId]);

  const afterPocketCreated = useCallback(() => {
    go('category-tab');
  }, [go]);

  const afterCategoryCreated = useCallback(() => {
    go('tour-home');
  }, [go]);

  useEffect(() => {
    if (!ready.current) return;
    if (step === 'pocket-tab' && pathname.includes('wallets') && !pathname.includes('new')) {
      persist('pocket-page');
      router.navigate('/(tabs)/wallets/new');
    }
    if (step === 'category-tab' && pathname.includes('categories') && !pathname.includes('new')) {
      persist('category-page');
      router.navigate('/(tabs)/categories/new' as never);
    }
  }, [pathname, persist, step]);

  const register = useCallback((id: string, rect: TargetRect | null) => {
    setRects((prev) => {
      if (!rect) {
        if (!(id in prev)) return prev;
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      const cur = prev[id];
      if (cur && cur.x === rect.x && cur.y === rect.y && cur.width === rect.width && cur.height === rect.height) {
        return prev;
      }
      return { ...prev, [id]: rect };
    });
  }, []);

  const finishTrial = useCallback(() => {
    if (userId) void setTrialOfferSeen(userId);
    persist('done');
  }, [persist, userId]);

  const meta = TUTORIAL_STEPS.find((s) => s.id === step) ?? null;
  const active = isActive(step);

  const value = useMemo<TutorialContextValue>(
    () => ({
      step,
      meta,
      active,
      rects,
      register,
      next: step === 'trial' ? finishTrial : next,
      skip: step === 'trial' ? finishTrial : skip,
      afterPocketCreated,
      afterCategoryCreated,
    }),
    [active, afterCategoryCreated, afterPocketCreated, finishTrial, meta, next, rects, register, skip, step]
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

function isActive(step: TutorialStep): boolean {
  return !!step && step !== 'done';
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}
