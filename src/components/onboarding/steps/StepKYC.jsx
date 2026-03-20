import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, Shield, Upload, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const ID_TYPES = ['passport', 'drivers_license', 'national_id', 'state_id'];
const DOC_TYPES = ['utility_bill', 'bank_statement', 'rental_agreement'];

export default function StepKYC({ data, onChange, onNext, onBack }) {
  const [uploading, setUploading] = useState({});

  const set = (k, v) => onChange({ ...data, [k]: v });

  const upload = async (field, file) => {
    if (!file) return;
    setUploading(p => ({ ...p, [field]: true }));
    const res = await base44.integrations.Core.UploadFile({ file });
    if (res?.file_url) set(field, res.file_url);
    setUploading(p => ({ ...p, [field]: false }));
  };

  const UploadBox = ({ field, label }) => (
    <label className={`block cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${data[field] ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'}`}>
      <input type="file" accept="image/*,.pdf" onChange={e => upload(field, e.target.files?.[0])} className="hidden" />
      {uploading[field] ? (
        <div className="text-xs text-slate-400">Uploading...</div>
      ) : data[field] ? (
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">Uploaded</span>
        </div>
      ) : (
        <>
          <Upload className="w-5 h-5 text-slate-500 mx-auto mb-1" />
          <div className="text-xs text-slate-400">{label}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">JPG, PNG or PDF</div>
        </>
      )}
    </label>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-amber-400" />
        <h2 className="text-base font-bold text-white">KYC Verification</h2>
        <span className="ml-auto text-[10px] text-slate-500">Optional — but required for high-value tasks</span>
      </div>

      {/* Notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 mb-4 flex gap-2">
        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/80 leading-relaxed">
          KYC verification is processed <strong>manually by an administrator</strong> and may take up to <strong>5 business days</strong>. Some identity-dependent features will be locked until approved.
        </div>
      </div>

      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
        {/* Personal info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Full Legal Name</label>
            <Input value={data.full_legal_name || ''} onChange={e => set('full_legal_name', e.target.value)}
              placeholder="As on ID" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Date of Birth</label>
            <Input type="date" value={data.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Residential Address</label>
          <Input value={data.residential_address || ''} onChange={e => set('residential_address', e.target.value)}
            placeholder="123 Main St" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[['city', 'City'], ['state', 'State'], ['postal_code', 'ZIP']].map(([k, label]) => (
            <div key={k}>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
              <Input value={data[k] || ''} onChange={e => set(k, e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
            </div>
          ))}
        </div>

        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Country</label>
          <Input value={data.country || ''} onChange={e => set('country', e.target.value)}
            placeholder="United States" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        </div>

        {/* ID Type */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Government ID Type</label>
          <div className="flex flex-wrap gap-1.5">
            {ID_TYPES.map(t => (
              <button key={t} type="button" onClick={() => set('government_id_type', t)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors capitalize ${data.government_id_type === t ? 'bg-amber-600/20 border-amber-500/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Document uploads */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Document Uploads</label>
          <div className="grid grid-cols-3 gap-2">
            <UploadBox field="id_document_front_url" label="ID Front" />
            <UploadBox field="id_document_back_url" label="ID Back" />
            <UploadBox field="selfie_url" label="Selfie" />
          </div>
        </div>

        {/* Supporting doc */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">Proof of Address (optional)</label>
          <UploadBox field="proof_of_address_url" label="Utility bill, bank statement, etc." />
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 flex gap-2">
          <AlertTriangle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-slate-500 leading-relaxed">
            You can skip this step and complete it later from the KYC Management section. However, prize claiming, grant applications, and high-value payouts will be restricted until verified.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
        <Button onClick={onBack} variant="outline" size="sm" className="border-slate-700 text-slate-400 h-9 px-4">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
        <Button onClick={onNext} variant="ghost" size="sm" className="text-slate-500 h-9 px-4">
          Skip for now
        </Button>
        <Button onClick={onNext} size="sm" className="flex-1 bg-amber-600 hover:bg-amber-500 text-white h-9">
          Submit KYC <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}