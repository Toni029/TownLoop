/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { useState } from 'react';
import {
  Mail,
  Lock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Sun,
  Moon,
  UserPlus,
  LogIn,
  User,
  MapPin,
  Phone,
  Building2
} from 'lucide-react';
import { loginUser, loginWithGoogle, signupUser, sendPasswordReset } from '../services/auth';
import { UserProfile } from '../types';
import { CecilPinesPines, CecilPinesBadge, UpcomingCommunityBadge } from './CecilPinesLogo';

interface AuthScreenProps {
  onAuthSuccess: (user: UserProfile) => void;
  isDarkMode?: boolean;
  onToggleTheme?: (dark: boolean) => void;
  onSwitchCommunity?: () => void;
  communityId?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  isDarkMode = false,
  onToggleTheme,
  onSwitchCommunity,
  communityId,
}) => {
  const isUpcoming = communityId === 'upcoming_community' || communityId === 'demo_community';

  // Tab switcher mode: 'signin' | 'register'
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Sign In Form State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Create Account Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const email = signInEmail.trim();

    if (!email) {
      setResetStatus({
        type: 'error',
        message: 'Please enter your email address first.',
      });
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordReset(email);
      setResetStatus({
        type: 'success',
        message: 'Password reset link sent to your email.',
      });
    } catch (err: any) {
      setResetStatus({
        type: 'error',
        message: err.message || 'Could not send password reset email.',
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const user = await loginUser(signInEmail.trim(), signInPassword);
      if (user.approved === false) {
        setSuccessMessage(`Account found. Redirecting to approval status...`);
      } else {
        setSuccessMessage(`Welcome back, ${user.name}!`);
      }
      setTimeout(() => {
        onAuthSuccess(user);
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not sign in with Firebase. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const enteredAddress = regAddress.trim();
      if (typeof window !== 'undefined' && enteredAddress) {
        try {
          const prefix = isUpcoming ? 'upcoming_community' : 'cecil_pines';
          sessionStorage.setItem(`${prefix}_registered_address`, enteredAddress);
          sessionStorage.setItem(`${prefix}_registered_address_${regEmail.trim().toLowerCase()}`, enteredAddress);
          localStorage.setItem(`${prefix}_registered_address`, enteredAddress);
        } catch {}
      }

      // Creates account with approved: false in Firestore
      const user = await signupUser({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        address: enteredAddress,
        phone: regPhone.trim() || undefined
      });

      setSuccessMessage('Registration created! Awaiting administrator approval...');
      setTimeout(() => {
        onAuthSuccess(user);
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      if (user.approved === false) {
        setSuccessMessage('Signed in with Google. Redirecting to pending approval...');
      } else {
        setSuccessMessage(`Welcome, ${user.name}!`);
      }
      setTimeout(() => {
        onAuthSuccess(user);
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-start pt-4 sm:pt-6 pb-12 sm:pb-16 px-4 sm:px-8 text-center animate-in fade-in duration-150 relative">
      {/* Ambient background glow for light mode */}
      {!isDarkMode && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
          <div
            className={`absolute -top-12 left-1/2 -translate-x-1/2 w-96 h-80 rounded-full blur-2xl ${
              isUpcoming
                ? 'bg-gradient-to-b from-stone-300/30 via-stone-200/20 to-transparent'
                : 'bg-gradient-to-b from-amber-200/25 via-emerald-100/30 to-transparent'
            }`}
          />
          <div
            className={`absolute top-1/3 -right-16 w-72 h-72 rounded-full blur-3xl ${
              isUpcoming ? 'bg-stone-200/25' : 'bg-amber-100/30'
            }`}
          />
        </div>
      )}

      {/* Top Utility Bar: Switch Community & Theme Toggle */}
      <div className="w-full flex items-center justify-between mb-3 sm:mb-4 z-20">
        {onSwitchCommunity ? (
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.scrollTo(0, 0);
              }
              onSwitchCommunity();
            }}
            title="Switch Community"
            aria-label="Switch Community"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 hover:bg-stone-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 border border-stone-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="whitespace-nowrap">Switch Community</span>
          </button>
        ) : (
          <div />
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={() => onToggleTheme(!isDarkMode)}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 sm:p-2.5 rounded-full bg-stone-100/95 hover:bg-stone-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-stone-700 dark:text-slate-200 border border-stone-300 dark:border-slate-700 transition cursor-pointer shadow-xs active:scale-95 shrink-0 ml-auto"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        )}
      </div>

      {/* Brand Emblem: Green Badge with Cecil Pines 3 Golden Pines OR Greyed out empty logo for Upcoming Community */}
      <div className="relative mb-2.5">
        {!isDarkMode && !isUpcoming && (
          <div className="absolute inset-0 bg-amber-400/20 rounded-3xl blur-md scale-110 -z-10" />
        )}
        {isUpcoming ? (
          <UpcomingCommunityBadge className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl p-3 shadow-md" />
        ) : (
          <CecilPinesBadge />
        )}
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col items-center mb-4">
        <h1
          className={`text-3xl sm:text-4xl font-black serif-title tracking-tight leading-none ${
            isUpcoming
              ? isDarkMode
                ? 'text-slate-100'
                : 'text-stone-800'
              : isDarkMode
              ? 'text-emerald-400'
              : 'text-[#0d4722]'
          }`}
        >
          {isUpcoming ? 'Upcoming Community' : 'Cecil Pines'}
        </h1>
        <div
          className={`w-44 sm:w-56 h-1 my-1.5 rounded-full ${
            isUpcoming
              ? isDarkMode
                ? 'bg-gradient-to-r from-transparent via-slate-600 to-transparent'
                : 'bg-gradient-to-r from-transparent via-stone-400 to-transparent'
              : 'bg-gradient-to-r from-transparent via-amber-500 to-transparent'
          }`}
        />
        <span
          className={`text-sm sm:text-base font-bold tracking-wider uppercase ${
            isUpcoming
              ? isDarkMode
                ? 'text-slate-400'
                : 'text-stone-600'
              : isDarkMode
              ? 'text-emerald-300'
              : 'text-[#155a33]'
          }`}
        >
          Active Adult Living Community
        </span>
        <span
          className={`inline-flex items-center text-xs sm:text-sm font-bold mt-2 px-3.5 py-1 rounded-full ${
            isUpcoming
              ? isDarkMode
                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                : 'bg-stone-100 text-stone-700 border border-stone-300 shadow-xs'
              : isDarkMode
              ? 'bg-slate-800 text-emerald-300 border border-slate-700'
              : 'bg-[#edf5ee] text-[#124d2c] border border-[#bcdbc6] shadow-xs'
          }`}
        >
          Resident Portal
        </span>
      </div>

      {/* Auth Card Container - wide, clear, high contrast */}
      <div className={`w-full max-w-md sm:max-w-xl rounded-[32px] p-5 sm:p-7 border-2 text-left transition-all duration-200 relative overflow-hidden shadow-xl ${
        isDarkMode
          ? 'bg-slate-900/95 border-slate-700 shadow-2xl text-slate-100'
          : 'bg-[#fffefc] border-[#dfd5c3] shadow-[0_20px_45px_-10px_rgba(70,50,25,0.15),0_2px_10px_rgba(0,0,0,0.04)] text-stone-900'
      }`}>
        {/* Tab Switcher: Sign In vs Create Account */}
        <div className={`flex rounded-2xl p-1.5 mb-5 border transition-colors gap-1 ${
          isDarkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-[#ede6d8] border-[#ded2bc]'
        }`}>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setErrorMessage(null);
              setSuccessMessage(null);
              setResetStatus(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-sm sm:text-base font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'signin'
                ? isDarkMode
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-[#0f4423] shadow-sm border border-[#d8cdb8]'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-[#6e6350] hover:text-stone-900'
            }`}
          >
            <LogIn className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMode('register');
              setErrorMessage(null);
              setSuccessMessage(null);
              setResetStatus(null);
            }}
            className={`flex-1 py-3 px-4 rounded-xl text-sm sm:text-base font-bold transition cursor-pointer flex items-center justify-center gap-2 ${
              authMode === 'register'
                ? isDarkMode
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-[#0f4423] shadow-sm border border-[#d8cdb8]'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-[#6e6350] hover:text-stone-900'
            }`}
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Header Label */}
        <div className={`mb-4 pb-3 border-b flex items-center justify-between transition-colors ${
          isDarkMode ? 'border-slate-800' : 'border-[#ece3d4]'
        }`}>
          <h2 className={`text-base sm:text-xl font-extrabold ${
            isDarkMode ? 'text-white' : 'text-[#154628]'
          }`}>
            {authMode === 'signin' ? 'Resident Sign In' : 'Create Resident Account'}
          </h2>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
            isDarkMode 
              ? 'text-slate-300 bg-slate-800 border border-slate-700' 
              : 'text-[#35523d] bg-[#f2ecde] border border-[#dcd3c3]'
          }`}>
            {authMode === 'signin' ? 'Secure Access' : 'Approval Required'}
          </span>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-sm sm:text-base flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm sm:text-base flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* ================= SIGN IN TAB ================= */}
        {authMode === 'signin' ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className={`block text-sm sm:text-base font-bold mb-1.5 ${
                isDarkMode ? 'text-slate-200' : 'text-[#243328]'
              }`}>
                Resident Email Address
              </label>
              <div className="relative">
                <Mail className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-[#7e735e]'
                }`} />
                <input
                  type="email"
                  required
                  placeholder="e.g. resident@cecilpines.com"
                  value={signInEmail}
                  onChange={e => setSignInEmail(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg font-medium border-2 outline-none transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-[#d4c8b6] bg-[#fcfaf5] text-stone-900 placeholder:text-stone-400 focus:border-[#175d3a] focus:bg-white focus:ring-4 focus:ring-[#175d3a]/15'
                  }`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`block text-sm sm:text-base font-bold ${
                  isDarkMode ? 'text-slate-200' : 'text-[#243328]'
                }`}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isSendingReset}
                  className={`text-sm sm:text-base font-normal transition hover:underline cursor-pointer ${
                    isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-[#7e735e] hover:text-stone-900'
                  }`}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-[#7e735e]'
                }`} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={signInPassword}
                  onChange={e => setSignInPassword(e.target.value)}
                  className={`w-full pl-11 pr-12 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg font-medium border-2 outline-none transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-[#d4c8b6] bg-[#fcfaf5] text-stone-900 placeholder:text-stone-400 focus:border-[#175d3a] focus:bg-white focus:ring-4 focus:ring-[#175d3a]/15'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className={`w-10 h-10 flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl cursor-pointer transition ${
                    isDarkMode ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800' : 'text-[#7e735e] hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {resetStatus && (
                <p
                  className={`text-xs sm:text-sm mt-1.5 font-normal transition-all ${
                    resetStatus.type === 'error'
                      ? isDarkMode ? 'text-amber-400' : 'text-amber-700'
                      : isDarkMode ? 'text-emerald-400' : 'text-emerald-700'
                  }`}
                >
                  {resetStatus.message}
                </p>
              )}
            </div>

            {/* Submit Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-[#175d3a] to-[#124b2e] hover:from-[#1b6b43] hover:to-[#175d3a] disabled:opacity-60 text-white font-bold text-base sm:text-lg shadow-lg shadow-emerald-950/25 transition cursor-pointer flex items-center justify-center gap-2.5 active:scale-98 min-h-[52px]"
            >
              {isLoading ? (
                <span className="text-base sm:text-lg font-bold">Signing in...</span>
              ) : (
                <>
                  <span className="text-base sm:text-lg font-bold tracking-wide">Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className={`w-full py-3 sm:py-3.5 px-4 rounded-2xl text-sm sm:text-base font-bold border-2 transition cursor-pointer flex items-center justify-center gap-3 min-h-[50px] ${
                isDarkMode
                  ? 'bg-slate-800/90 hover:bg-slate-800 text-slate-100 border-slate-700'
                  : 'bg-[#faf6ee] hover:bg-[#f2ebe0] text-stone-900 border-[#d8cebe] shadow-xs'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>
        ) : (
          /* ================= CREATE ACCOUNT TAB ================= */
          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Resident Full Name */}
            <div>
              <label className={`block text-sm sm:text-base font-bold mb-1.5 ${
                isDarkMode ? 'text-slate-200' : 'text-[#243328]'
              }`}>
                Resident Full Name
              </label>
              <div className="relative">
                <User className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-[#7e735e]'
                }`} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Martha Stewart"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg font-medium border-2 outline-none transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-[#d4c8b6] bg-[#fcfaf5] text-stone-900 placeholder:text-stone-400 focus:border-[#175d3a] focus:bg-white focus:ring-4 focus:ring-[#175d3a]/15'
                  }`}
                />
              </div>
            </div>

            {/* Resident Email */}
            <div>
              <label className={`block text-sm sm:text-base font-bold mb-1.5 ${
                isDarkMode ? 'text-slate-200' : 'text-[#243328]'
              }`}>
                Resident Email Address
              </label>
              <div className="relative">
                <Mail className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-[#7e735e]'
                }`} />
                <input
                  type="email"
                  required
                  placeholder="resident@cecilpines.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg font-medium border-2 outline-none transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-[#d4c8b6] bg-[#fcfaf5] text-stone-900 placeholder:text-stone-400 focus:border-[#175d3a] focus:bg-white focus:ring-4 focus:ring-[#175d3a]/15'
                  }`}
                />
              </div>
            </div>

            {/* Single Address Bar */}
            <div>
              <label className={`block text-sm sm:text-base font-bold mb-1.5 ${
                isDarkMode ? 'text-slate-200' : 'text-[#243328]'
              }`}>
                Address (Street Address)
              </label>
              <div className="relative">
                <MapPin className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-[#7e735e]'
                }`} />
                <input
                  type="text"
                  required
                  placeholder="e.g. 6100 Normandy Blvd"
                  value={regAddress}
                  onChange={e => setRegAddress(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg font-medium border-2 outline-none transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-[#d4c8b6] bg-[#fcfaf5] text-stone-900 placeholder:text-stone-400 focus:border-[#175d3a] focus:bg-white focus:ring-4 focus:ring-[#175d3a]/15'
                  }`}
                />
              </div>
            </div>

            {/* Phone (Optional) */}
            <div>
              <label className={`block text-sm sm:text-base font-bold mb-1.5 ${
                isDarkMode ? 'text-slate-200' : 'text-[#243328]'
              }`}>
                Phone Number <span className="font-normal text-stone-400 text-sm">(optional)</span>
              </label>
              <div className="relative">
                <Phone className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-[#7e735e]'
                }`} />
                <input
                  type="tel"
                  placeholder="(904) 555-0100"
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg font-medium border-2 outline-none transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-[#d4c8b6] bg-[#fcfaf5] text-stone-900 placeholder:text-stone-400 focus:border-[#175d3a] focus:bg-white focus:ring-4 focus:ring-[#175d3a]/15'
                  }`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className={`block text-sm sm:text-base font-bold mb-1.5 ${
                isDarkMode ? 'text-slate-200' : 'text-[#243328]'
              }`}>
                Create Password <span className="font-normal text-stone-400 text-sm">(min 6 characters)</span>
              </label>
              <div className="relative">
                <Lock className={`w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDarkMode ? 'text-slate-400' : 'text-[#7e735e]'
                }`} />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  className={`w-full pl-11 pr-12 py-3 sm:py-3.5 rounded-2xl text-base sm:text-lg font-medium border-2 outline-none transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-950/80 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:bg-slate-900 focus:ring-4 focus:ring-emerald-500/20'
                      : 'border-[#d4c8b6] bg-[#fcfaf5] text-stone-900 placeholder:text-stone-400 focus:border-[#175d3a] focus:bg-white focus:ring-4 focus:ring-[#175d3a]/15'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  className={`w-10 h-10 flex items-center justify-center absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl cursor-pointer transition ${
                    isDarkMode ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800' : 'text-[#7e735e] hover:text-stone-900 hover:bg-stone-200/60'
                  }`}
                >
                  {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit Registration Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-[#175d3a] to-[#124b2e] hover:from-[#1b6b43] hover:to-[#175d3a] disabled:opacity-60 text-white font-bold text-base sm:text-lg shadow-lg transition cursor-pointer flex items-center justify-center gap-2.5 active:scale-98 min-h-[52px]"
            >
              {isLoading ? (
                <span className="text-base sm:text-lg font-bold">Registering with Firestore...</span>
              ) : (
                <>
                  <span className="text-base sm:text-lg font-bold">Create Account & Request Approval</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <span className={`text-sm sm:text-base ${isDarkMode ? 'text-slate-300' : 'text-stone-700'}`}>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('signin')}
                  className="font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            </div>
          </form>
        )}
      </div>

      <div className="mt-4 text-center space-y-1">
        <p className={`text-xs sm:text-sm font-medium transition-colors ${
          isDarkMode ? 'text-slate-400' : 'text-[#635949]'
        }`}>
          {isUpcoming
            ? 'Upcoming Community Support Concierge: (904) 555-0100'
            : 'Cecil Pines Adult Living Community Concierge: (904) 555-0100'}
        </p>
        <p className={`text-[11px] font-medium transition-colors ${
          isDarkMode ? 'text-slate-500' : 'text-stone-400'
        }`}>
          Version 1.0.0 • © 2026 TownLoop • All rights reserved.
        </p>
      </div>
    </div>
  );
};
