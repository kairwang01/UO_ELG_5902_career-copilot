import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { firebaseAuth } from '@/lib/firebaseClient';
import { completeAuthActionOnce, type AuthActionOutcome } from '@/lib/auth/completeAuthAction';
import { SITE_ROUTES } from '../../config/site';
import { useMarketingI18n } from '../hooks/useMarketingI18n';

type ViewState =
  | { phase: 'loading' }
  | { phase: 'done'; outcome: AuthActionOutcome };

export const AuthActionPage: React.FC = () => {
  const { t } = useMarketingI18n();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<ViewState>({ phase: 'loading' });

  useEffect(() => {
    let active = true;
    const run = async () => {
      // Memoized per link: StrictMode's double effect and same-tab revisits
      // share one applyActionCode call instead of consuming the code twice.
      const outcome = await completeAuthActionOnce(firebaseAuth, searchParams.toString());
      if (active) setView({ phase: 'done', outcome });
    };
    void run();
    return () => {
      active = false;
    };
  }, [searchParams]);

  if (view.phase === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-blue-700" aria-hidden="true" />
        <p className="text-sm font-medium">{t('auth_action_verifying')}</p>
      </div>
    );
  }

  const { outcome } = view;

  if (outcome.status === 'success' && outcome.mode === 'verifyEmail') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">{t('auth_action_verify_success_title')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('auth_action_verify_success_body')}</p>
          <Link
            to={SITE_ROUTES.portal}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white hover:bg-blue-800"
          >
            {t('auth_action_verify_success_cta')}
          </Link>
        </div>
      </div>
    );
  }

  if (outcome.status === 'ready' && outcome.mode === 'resetPassword') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">{t('auth_action_reset_use_app')}</p>
          <Link to={SITE_ROUTES.home} className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:underline">
            {t('auth_action_back_home')}
          </Link>
        </div>
      </div>
    );
  }

  const errorKey =
    outcome.status === 'error' && outcome.reason === 'expired_or_invalid'
      ? 'auth_action_error_expired'
      : 'auth_action_error_generic';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <XCircle className="mx-auto h-12 w-12 text-amber-600" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">{t('auth_action_error_title')}</h1>
        <p className="mt-2 text-sm text-slate-600">{t(errorKey)}</p>
        <Link
          to={SITE_ROUTES.portal}
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {t('auth_action_back_signin')}
        </Link>
      </div>
    </div>
  );
};
