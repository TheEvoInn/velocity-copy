import React, { useState, useEffect } from 'react';
import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileCheck, AlertCircle, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function KYCIntakeForm({ onSubmitSuccess }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_legal_name: '',
    date_of_birth: '',
    residential_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
    phone_number: '',
    email_verified: '',
    government_id_type: 'passport',
    government_id_number: '',
    government_id_expiry: '',
    tax_id: '',
  });
  const [documents, setDocuments] = useState({
    id_front: null,
    id_back: null,
    selfie: null,
  });
  const [showSensitive, setShowSensitive] = useState(false);
  const queryClient = useQueryClient();

  const [uploadProgress, setUploadProgress] = useState('');

  const submitKYC = useMutation({
    mutationFn: async () => {
      const uploadFile = async (file, label) => {
        if (!file) return null;
        setUploadProgress(`Uploading ${label}...`);
        const result = await base44.integrations.Core.UploadFile({ file });
        if (!result?.file_url) throw new Error(`Failed to upload ${label}`);
        return result.file_url;
      };

      const id_document_front_url = await uploadFile(documents.id_front, 'ID Front');
      const id_document_back_url  = await uploadFile(documents.id_back,  'ID Back');
      const selfie_url             = await uploadFile(documents.selfie,   'Selfie');
      setUploadProgress('Saving application...');

      const kyc = await base44.entities.KYCVerification.create({
        ...formData,
        id_document_front_url,
        id_document_back_url,
        selfie_url,
        status: 'submitted',
        admin_status: 'submitted',
        verification_type: 'standard',
      });
      return kyc;
    },
    onSuccess: (data) => {
      setUploadProgress('');
      queryClient.invalidateQueries({ queryKey: ['kyc_my'] });
      queryClient.invalidateQueries({ queryKey: ['kyc_admin_notifications'] });
      toast.success('Application submitted. An administrator will review it within 5 business days.');
      if (onSubmitSuccess) onSubmitSuccess(data);
    },
    onError: (error) => {
      setUploadProgress('');
      toast.error(`KYC submission failed: ${error.message || 'Unknown error'}`);
    },
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field, file) => {
    if (file) {
      setDocuments(prev => ({ ...prev, [field]: file }));
    }
  };

  const isStep1Complete = formData.full_legal_name && formData.date_of_birth && formData.residential_address && formData.city && formData.state && formData.postal_code;
  const isStep2Complete = formData.phone_number && formData.email_verified && formData.government_id_type && formData.government_id_number && formData.government_id_expiry;
  const isStep3Complete = documents.id_front && documents.id_back && documents.selfie;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`flex items-center gap-2 text-xs font-semibold ${
                s <= step ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  s < step
                    ? 'bg-emerald-600'
                    : s === step
                    ? 'bg-emerald-500 ring-2 ring-emerald-400'
                    : 'bg-slate-700'
                }`}
              >
                {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {['Personal', 'Contact & ID', 'Documents', 'Review'][s - 1]}
            </div>
          ))}
        </div>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 1: Personal Information */}
      {step === 1 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              Personal Information
            </CardTitle>
            <p className="text-xs text-slate-400 mt-2">All information is encrypted and stored securely</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Full Legal Name *</label>
              <Input
                value={formData.full_legal_name}
                onChange={e => handleInputChange('full_legal_name', e.target.value)}
                placeholder="As it appears on government ID"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Date of Birth *</label>
              <Input
                type="date"
                value={formData.date_of_birth}
                onChange={e => handleInputChange('date_of_birth', e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Residential Address *</label>
              <Input
                value={formData.residential_address}
                onChange={e => handleInputChange('residential_address', e.target.value)}
                placeholder="Street address"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">City *</label>
                <Input
                  value={formData.city}
                  onChange={e => handleInputChange('city', e.target.value)}
                  placeholder="City"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">State *</label>
                <Input
                  value={formData.state}
                  onChange={e => handleInputChange('state', e.target.value)}
                  placeholder="State"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Postal Code *</label>
              <Input
                value={formData.postal_code}
                onChange={e => handleInputChange('postal_code', e.target.value)}
                placeholder="Postal code"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => setStep(2)} disabled={!isStep1Complete} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Contact & ID Information */}
      {step === 2 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              Contact & Identity Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Phone Number *</label>
              <Input
                type="tel"
                value={formData.phone_number}
                onChange={e => handleInputChange('phone_number', e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Verified Email *</label>
              <Input
                type="email"
                value={formData.email_verified}
                onChange={e => handleInputChange('email_verified', e.target.value)}
                placeholder="your@email.com"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Government ID Type *</label>
                <select
                  value={formData.government_id_type}
                  onChange={e => handleInputChange('government_id_type', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 text-sm"
                >
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="national_id">National ID</option>
                  <option value="state_id">State ID</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">ID Expiry Date *</label>
                <Input
                  type="date"
                  value={formData.government_id_expiry}
                  onChange={e => handleInputChange('government_id_expiry', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Government ID Number *</label>
                <button
                  onClick={() => setShowSensitive(!showSensitive)}
                  className="text-slate-500 hover:text-slate-300 p-1"
                >
                  {showSensitive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
              <Input
                type={showSensitive ? 'text' : 'password'}
                value={formData.government_id_number}
                onChange={e => handleInputChange('government_id_number', e.target.value)}
                placeholder="ID number (encrypted)"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">Tax ID / SSN (Optional)</label>
              <Input
                type={showSensitive ? 'text' : 'password'}
                value={formData.tax_id}
                onChange={e => handleInputChange('tax_id', e.target.value)}
                placeholder="Tax ID (encrypted)"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!isStep2Complete} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Document Upload */}
      {step === 3 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-emerald-400" />
              Upload Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-950/30 border border-blue-900/30 rounded-lg p-3">
              <p className="text-xs text-blue-200">Upload clear, legible photos of your documents. All images are encrypted and stored securely.</p>
            </div>
            {['id_front', 'id_back', 'selfie'].map((field, idx) => (
              <div key={field}>
                <label className="text-xs font-semibold text-slate-300 mb-2 block">
                  {field === 'id_front' ? 'ID Front *' : field === 'id_back' ? 'ID Back *' : 'Selfie (Face Match) *'}
                </label>
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileUpload(field, e.target.files?.[0])}
                    className="hidden"
                    id={field}
                  />
                  <label htmlFor={field} className="cursor-pointer block">
                    {documents[field] ? (
                      <div className="space-y-2">
                        <img
                          src={URL.createObjectURL(documents[field])}
                          alt={field}
                          className="w-full max-h-36 object-contain rounded-lg border border-slate-700"
                        />
                        <div className="flex items-center justify-center gap-2 text-emerald-400">
                          <FileCheck className="w-4 h-4" />
                          <span className="text-xs">{documents[field].name}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-5 h-5 text-slate-500" />
                        <span className="text-xs text-slate-400">Click to upload</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-4">
              <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(4)} disabled={!isStep3Complete} className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Review & Submit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200">
                By submitting, you agree that this information is accurate and will be used only when legally required for Autopilot tasks.
              </p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Name:</span>
                <span className="text-white font-semibold">{formData.full_legal_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">DOB:</span>
                <span className="text-white font-semibold">{formData.date_of_birth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Address:</span>
                <span className="text-white font-semibold">{formData.city}, {formData.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ID Type:</span>
                <span className="text-white font-semibold capitalize">{formData.government_id_type.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Documents:</span>
                <span className="text-emerald-400 font-semibold">3 files ready</span>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={() => setStep(3)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => submitKYC.mutate()}
                disabled={submitKYC.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              >
                {submitKYC.isPending ? (uploadProgress || 'Submitting...') : 'Submit for Verification'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}