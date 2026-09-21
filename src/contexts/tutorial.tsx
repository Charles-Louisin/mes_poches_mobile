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
import { router, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/auth';
import {
  getSetupStep,
  getTrialOfferSeen,
  setSetupStep,
  setTrialOfferSeen,
  subscribeSetup,
  type TutorialStep,
} from '@/lib/setupGuide';

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
    title: 'Votre première poche',
    body: 'Une poche = un compte (Cash, Orange, MTN, banque). Appuyez sur Poches.',
    mode: 'tap',
  },
  {
    id: 'pocket-add',
    target: 'wallet-add',
    title: 'Créer la poche',
    body: 'Appuyez sur + pour ajouter votre premier compte.',
    mode: 'tap',
    route: '/(tabs)/wallets',
  },
  {
    id: 'pocket-name',
    target: 'wallet-name',
    title: 'Nommez-la',
    body: 'Saisissez un nom dans le champ éclairé, par exemple Cash ou Orange Money.',
    mode: 'input',
    cta: 'Continuer',
  },
  {
    id: 'pocket-image',
    target: 'wallet-image',
    title: 'Une image (optionnel)',
    body: 'Ajoutez une icône pour reconnaître la poche d’un coup d’œil. Vous pouvez aussi passer.',
    mode: 'input',
    cta: 'Continuer',
  },
  {
    id: 'pocket-balance',
    target: 'wallet-balance',
    title: 'Le solde actuel',
    body: 'Indiquez ce qu’il y a déjà sur ce compte. Zéro si vous partez de rien.',
    mode: 'input',
    cta: 'Continuer',
  },
  {
    id: 'pocket-submit',
    target: 'wallet-submit',
    title: 'Enregistrer',
    body: 'Appuyez sur Créer la poche pour valider.',
    mode: 'tap',
  },
  {
    id: 'category-tab',
    target: 'tab-categories',
    title: 'Les catégories',
    body: 'Elles classent vos dépenses et revenus. Appuyez sur Catégories.',
    mode: 'tap',
    route: '/(tabs)/categories',
  },
  {
    id: 'category-name',
    target: 'category-name',
    title: 'Première catégorie',
    body: 'Tapez un nom : Transport, Marché, Salaire…',
    mode: 'input',
    cta: 'Continuer',
  },
  {
    id: 'category-submit',
    target: 'category-submit',
    title: 'Enregistrer',
    body: 'Appuyez sur Enregistrer pour créer la catégorie.',
    mode: 'tap',
  },
  {
    id: 'tour-home',
    target: 'tab-home',
    title: 'Accueil',
    body: 'Le solde global, les 4 actions (dépense, revenu, scan, virement) et vos poches.',
    mode: 'next',
    cta: 'Suivant',
    route: '/(tabs)',
  },
  {
    id: 'tour-transactions',
    target: 'tab-transactions',
    title: 'Historique',
    body: 'L’historique de vos mouvements, les filtres et les dépenses prévues.',
    mode: 'next',
    cta: 'Suivant',
    route: '/(tabs)/transactions',
  },
  {
    id: 'tour-wallets',
    target: 'tab-wallets',
    title: 'Poches',
    body: 'Chaque compte a son solde. Ouvrez-en autant que vous avez de comptes.',
    mode: 'next',
    cta: 'Suivant',
    route: '/(tabs)/wallets',
  },
  {
    id: 'tour-analytics',
    target: 'tab-analytics',
    title: 'Analyse',
    body: 'Le mois, les écarts et la répartition par catégorie. Une partie est Premium.',
    mode: 'next',
    cta: 'Suivant',
    route: '/(tabs)/analytics',
  },
  {
    id: 'tour-plus',
    target: 'tab-plus',
    title: 'Plus',
    body: 'Objectifs, file « À valider » (SMS, tickets, dictées), réglages et export.',
    mode: 'next',
    cta: 'Suivant',
    route: '/(tabs)/plus',
  },
  {
    id: 'success',
    title: 'Tutoriel terminé',
    body: 'Bienvenue dans Mes Poches. Suivez vos comptes, validez vos détections, et gardez le contrôle.',
    mode: 'modal',
    cta: 'C’est parti',
  },
  {
    id: 'trial',
    title: '1 mois Premium offert',
    body: 'Scan, dictée, exports, budgets et objectifs : tout est débloqué pendant 30 jours.',
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
      persist('pocket-add');
    }
    if (step === 'pocket-add' && pathname.includes('wallets/new')) {
      persist('pocket-name');
    }
    if (
      (step === 'pocket-image' || step === 'pocket-balance' || step === 'pocket-submit') &&
      pathname.includes('wallets') &&
      !pathname.includes('new')
    ) {
      persist('pocket-add');
    }
    if (step === 'category-tab' && pathname.includes('categories')) {
      persist('category-name');
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
