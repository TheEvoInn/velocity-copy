import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function KYCUpdateForm({ kycRecord, onClose }) {
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    full_legal_name: kycRecord.full_legal_name || '',
    date_of_birth: kycRecord.date_of_birth || '',
    residential_address: kycRecord.residential_address || '',
    city: kycRecord.city || '',
    state: kycRecord.state || '',
    postal_code: kycRecord.postal_code || '',
    country: kycRecord.country || '',
    phone_number: kycRecord.phone_number || '',
    government_id_type: kycRecord.government_id_type || 'passport',
    government_id_expiry: kycRecord.government_id_expiry || '',
  });

  // Check if admin requested specific fields to be rechecked
  const checkAgainFields = kycRecord.check_again_fields || [];
  const isCheckAgainMode = kycRecord.admin_status === 'check_again_required';

  const [files, setFiles] = useState({
    id_front: null,
    id_back: null,
    selfie: null,
  });

  const [uploading, setUploading] = useState({});

  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const res = await base44.functions.invoke('kycAdminService', {
        action: 'update',
        id: kycRecord.id,
        updates: {
          ...updates,
          status: 'submitted',
          admin_status: 'submitted',
        },
      });
      return res.data?.record;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc_my'] });
      toast.success('KYC information updated successfully — submitted for review.');
      onClose();
    },
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  const handleFileUpload = async (field, file) => {
    if (!file) return;
    setUploading((p) => ({ ...p, [field]: true }));
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const urlField = field === 'id_front' ? 'id_document_front_url' : field === 'id_back' ? 'id_document_back_url' : 'selfie_url';
      setFiles((p) => ({ ...p, [field]: res.file_url }));
      toast.success(`${field.replace('_', ' ')} uploaded.`);
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading((p) => ({ ...p, [field]: false }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.full_legal_name || !formData.date_of_birth || !formData.residential_address) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const updates = {
      ...formData,
      id_document_front_url: files.id_front || kycRecord.id_document_front_url,
      id_document_back_url: files.id_back || kycRecord.id_document_back_url,
      selfie_url: files.selfie || kycRecord.selfie_url,
    };

    // Clear check_again flag when user resubmits
    if (isCheckAgainMode) {
      updates.check_again_fields = [];
    }

    updateMutation.mutate(updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-white font-semibold">Update KYC Information</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Check Again Notice */}
          {isCheckAgainMode && (
            <div className="bg-purple-950/40 border border-purple-800/40 rounded-lg p-3">
              <p className="text-xs font-semibold text-purple-300 mb-1">Admin Review Request</p>
              <p className="text-xs text-purple-200">
                An administrator has asked you to review and correct the following information:
              </p>
              <div className="mt-2 space-y-1">
                {checkAgainFields.map(field => (
                  <p key={field} className="text-xs text-purple-300 font-medium">
                    • {field.replace(/_/g, ' ').toUpperCase()}
                  </p>
                ))}
              </div>
              {kycRecord.admin_request_note && (
                <p className="text-xs text-purple-200 mt-2 italic">"{kycRecord.admin_request_note}"</p>
              )}
            </div>
          )}
          {/* Personal Info */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name *</label>
            <input
              type="text"
              value={formData.full_legal_name}
              onChange={(e) => setFormData((p) => ({ ...p, full_legal_name: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth *</label>
              <input
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => setFormData((p) => ({ ...p, date_of_birth: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">ID Type</label>
              <select
                value={formData.government_id_type}
                onChange={(e) => setFormData((p) => ({ ...p, government_id_type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              >
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver's License</option>
                <option value="national_id">National ID</option>
                <option value="state_id">State ID</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">ID Expiry Date</label>
            <input
              type="date"
              value={formData.government_id_expiry}
              onChange={(e) => setFormData((p) => ({ ...p, government_id_expiry: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Residential Address *</label>
            <input
              type="text"
              value={formData.residential_address}
              onChange={(e) => setFormData((p) => ({ ...p, residential_address: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="City"
              value={formData.city}
              onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
            <input
              type="text"
              placeholder="State"
              value={formData.state}
              onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
            <input
              type="text"
              placeholder="Postal Code"
              value={formData.postal_code}
              onChange={(e) => setFormData((p) => ({ ...p, postal_code: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Country"
              value={formData.country}
              onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={formData.phone_number}
              onChange={(e) => setFormData((p) => ({ ...p, phone_number: e.target.value }))}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Document Uploads */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs font-semibold text-slate-400 mb-3">Upload Documents (Optional)</p>
            {[
              { key: 'id_front', label: 'Government ID (Front)' },
              { key: 'id_back', label: 'Government ID (Back)' },
              { key: 'selfie', label: 'Selfie / Liveness Check' },
            ].map(({ key, label }) => (
              <div key={key} className="mb-3">
                <label className="block text-xs text-slate-300 mb-1">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(key, e.target.files?.[0])}
                    disabled={uploading[key]}
                    className="flex-1 text-xs text-slate-400 file:bg-slate-700 file:border file:border-slate-600 file:rounded file:px-2 file:py-1 file:text-xs file:text-white cursor-pointer"
                  />
                  {uploading[key] && <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
                  {files[key] && <div className="text-xs text-emerald-400">✓ Uploaded</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-2">
            <p className="text-[10px] text-blue-300">
              Your updated information will be submitted for review. All data is encrypted and stored securely.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 p-4 flex gap-2 justify-end">
          <Button onClick={onClose} variant="outline" size="sm" className="border-slate-600 text-slate-300">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm gap-1.5"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Submit Updates
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}