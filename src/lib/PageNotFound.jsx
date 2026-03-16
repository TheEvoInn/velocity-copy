import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <Zap className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-6xl font-bold text-white mb-2">404</h1>
        <p className="text-sm text-slate-500 mb-6">This page doesn't exist in the profit matrix.</p>
        <Link to="/Dashboard">
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Command Center
          </Button>
        </Link>
      </div>
    </div>
  );
}