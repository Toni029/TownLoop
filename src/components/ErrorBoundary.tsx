/*
 * Copyright (c) 2026 Antonio Merlano / Seeds4Clix. All rights reserved.
 * Proprietary and Confidential.
 * Unauthorized copying, distribution, or modification of this source code,
 * via any medium, is strictly prohibited.
 */
import React, { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  viewName?: string;
  fallback?: ReactNode | ((props: { error: Error | null; resetError: () => void }) => ReactNode);
  onReset?: () => void;
  className?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Robust React Error Boundary that catches unhandled runtime and render errors
 * in child components, preventing the entire portal from crashing to a blank screen.
 * Displays an accessible, graceful fallback card ('Something went wrong loading this view — Tap to retry').
 */
export class ErrorBoundary extends (Component as any) {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(
      `[ErrorBoundary${this.props.viewName ? ` - ${this.props.viewName}` : ''}] Unhandled render error:`,
      error,
      errorInfo
    );
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.resetError,
        });
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { viewName, className = '' } = this.props;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className={`w-full min-h-[300px] flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-white/95 dark:bg-slate-900/95 border-2 border-amber-300/80 dark:border-amber-800/60 shadow-lg text-center backdrop-blur-sm transition-all duration-200 my-auto ${className}`}
        >
          {/* Status Emblem */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-4 shadow-xs">
            <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>

          {/* Primary Notice */}
          <h3 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-slate-100 tracking-tight leading-snug mb-2">
            Something went wrong loading this view — Tap to retry
          </h3>

          <p className="text-sm text-stone-600 dark:text-slate-300 max-w-sm mx-auto mb-6 leading-relaxed">
            {viewName
              ? `An unexpected issue occurred while displaying ${viewName}. Your session and community data are safely preserved.`
              : 'An unexpected issue occurred while displaying this section. Your session and community data are safely preserved.'}
          </p>

          {/* Senior-friendly retry action button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={this.resetError}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-sm sm:text-base shadow-md active:scale-98 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 text-emerald-200" />
              <span>Tap to retry</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
