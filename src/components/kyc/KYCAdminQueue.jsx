import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, Clock, CheckCircle2, XCircle, AlertTriangle, Eye, EyeOff,
  MessageSquare, Flag, User, FileText, ChevronDown, ChevronUp, RefreshCw, Upload, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const STATUS_STYLES = {
  submitted:       { color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/25',    label: 'Pending Review' },
  under_review:    { color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/25',  label: 'Under Review' },
  approved:        { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/25', label: 'Approved' },
  rejected:        { color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/25',      label: 'Denied' },
  additional_info: { color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border-yellow-500/25',label: 'Info Requested' },
  flagged:         { color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/25',label: 'Flagged' },
};

function KYCReviewCard({ record, onAction }) {
  const [expanded, setExpanded] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [actionMode, setActionMode] = useState(null); // 'deny' | 'request' | 'flag' | 'upload' | 'check_again'
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [uploadedDocs, setUploadedDocs] = useState({});
  const [selectedFields, setSelectedFields] = useState({});
  const [formData, setFormData] = useState({
    full_legal_name: record.full_legal_name || '',
    date_of_birth: record.date_of_birth || '',
    phone_number: record.phone_number || '',
    residential_address: record.residential_address || '',
    city: record.city || '',
    state: record.state || '',
    postal_code: record.postal_code || '',
    country: record.country || '',
    government_id_type: record.government_id_type || 'passport',
    government_id_expiry: record.government_id_expiry || '',
    tax_id: record.tax_id || '',
  });
  const fileRefs = {
    id_front: React.useRef(null),
    id_back: React.useRef(null),
    selfie: React.useRef(null),
  };

  const CHECKABLE_FIELDS = [
    { key: 'full_legal_name', label: 'Full Legal Name' },
    { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'phone_number', label: 'Phone Number' },
    { key: 'residential_address', label: 'Residential Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'postal_code', label: 'Postal Code' },
    { key: 'country', label: 'Country' },
    { key: 'government_id_type', label: 'Government ID Type' },
    { key: 'government_id_number', label: 'Government ID #' },
    { key: 'government_id_expiry', label: 'ID Expiry Date' },
    { key: 'tax_id', label: 'Tax ID #' },
    { key: 'id_front', label: 'ID Document (Front)' },
    { key: 'id_back', label: 'ID Document (Back)' },
    { key: 'selfie', label: 'Selfie/Liveness' },
  ];

  const statusKey = record.admin_status || record.status || 'submitted';
  const style = STATUS_STYLES[statusKey] || STATUS_STYLES.submitted;

  const handleDocUpload = async (docType, file) => {
    if (!file) return;
    setUploadingDocs((p) => ({ ...p, [docType]: true }));
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setUploadedDocs((p) => ({ ...p, [docType]: res.file_url }));
      if (fileRefs[docType]?.current) {
        fileRefs[docType].current.value = '';
      }
      toast.success(`${docType.replace(/_/g, ' ')} uploaded.`);
    } catch (err) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploadingDocs((p) => ({ ...p, [docType]: false }));
    }
  };

  const handleSubmitDocuments = async () => {
    if (!formData.full_legal_name || !formData.date_of_birth || !formData.residential_address) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const updates = { ...formData };
    if (uploadedDocs.id_front) updates.id_document_front_url = uploadedDocs.id_front;
    if (uploadedDocs.id_back) updates.id_document_back_url = uploadedDocs.id_back;
    if (uploadedDocs.selfie) updates.selfie_url = uploadedDocs.selfie;

    onAction(record.id, 'submit_docs', { docUpdates: updates });
    setActionMode(null);
    setUploadedDocs({});
  };

  const handleCheckAgain = async () => {
    const selected = Object.keys(selectedFields).filter(k => selectedFields[k]);
    if (selected.length === 0) {
      toast.error('Please select at least one field to recheck.');
      return;
    }

    onAction(record.id, 'check_again', { fields: selected, note: noteText });
    setActionMode(null);
    setSelectedFields({});
    setNoteText('');
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header Row */}
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
            <User className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">{record.full_legal_name || 'Unknown'}</p>
            <p className="text-slate-500 text-xs">{record.email_verified} · Submitted {new Date(record.created_date).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-md border ${style.bg} ${style.color}`}>
            {style.label}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 p-4 space-y-4">
          {/* Personal Info */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Personal Information</p>
              <button onClick={() => setShowSensitive(s => !s)} className="text-slate-500 hover:text-slate-300">
                {showSensitive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              {[
                ['Full Name', record.full_legal_name],
                ['Date of Birth', record.date_of_birth],
                ['Phone', record.phone_number],
                ['Email', record.email_verified],
                ['ID Type', record.government_id_type?.replace(/_/g, ' ')],
                ['ID Expiry', record.government_id_expiry],
                ['Tax ID', showSensitive ? record.tax_id : record.tax_id ? '••••••••' : '—'],
                ['Gov ID #', showSensitive ? record.government_id_number : record.government_id_number ? '••••••••' : '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-slate-500">{label}</p>
                  <p className="text-white font-medium">{val || '—'}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-slate-500">Address</p>
                <p className="text-white font-medium">
                  {[record.residential_address, record.city, record.state, record.postal_code, record.country].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Documents</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['ID Front', record.id_document_front_url, 'id_front'],
                ['ID Back', record.id_document_back_url, 'id_back'],
                ['Selfie', record.selfie_url, 'selfie'],
              ].map(([label, url, key]) => (
                <div key={label} className="bg-slate-800 rounded-lg p-2 text-center">
                  {url || uploadedDocs[key] ? (
                    <a href={uploadedDocs[key] || url} target="_blank" rel="noopener noreferrer">
                      <img src={uploadedDocs[key] || url} alt={label} className="w-full h-20 object-cover rounded mb-1 border border-slate-600" />
                      <p className="text-xs text-blue-400 hover:underline">{uploadedDocs[key] ? '✓ ' : ''}{label} ↗</p>
                    </a>
                  ) : (
                    <>
                      <div className="w-full h-20 bg-slate-700 rounded mb-1 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-slate-500" />
                      </div>
                      <p className="text-xs text-slate-500">{label} (not uploaded)</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Admin Submit for User Mode */}
          {actionMode === 'upload' && (
            <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-3 space-y-3 max-h-64 overflow-y-auto">
              <p className="text-xs font-semibold text-blue-300 sticky top-0">Edit User Information & Upload Documents</p>

              {/* Personal Info */}
              <div className="space-y-2">
                <p className="text-xs text-blue-200 font-semibold">Personal Information</p>
                <input
                  type="text"
                  placeholder="Full Legal Name"
                  value={formData.full_legal_name}
                  onChange={(e) => setFormData((p) => ({ ...p, full_legal_name: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData((p) => ({ ...p, date_of_birth: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData((p) => ({ ...p, phone_number: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <p className="text-xs text-blue-200 font-semibold">Address</p>
                <input
                  type="text"
                  placeholder="Residential Address"
                  value={formData.residential_address}
                  onChange={(e) => setFormData((p) => ({ ...p, residential_address: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <div className="grid grid-cols-3 gap-1">
                  <input type="text" placeholder="City" value={formData.city} onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))} className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
                  <input type="text" placeholder="State" value={formData.state} onChange={(e) => setFormData((p) => ({ ...p, state: e.target.value }))} className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
                  <input type="text" placeholder="ZIP" value={formData.postal_code} onChange={(e) => setFormData((p) => ({ ...p, postal_code: e.target.value }))} className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
                </div>
                <input type="text" placeholder="Country" value={formData.country} onChange={(e) => setFormData((p) => ({ ...p, country: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
              </div>

              {/* ID Info */}
              <div className="space-y-2">
                <p className="text-xs text-blue-200 font-semibold">Government ID</p>
                <select value={formData.government_id_type} onChange={(e) => setFormData((p) => ({ ...p, government_id_type: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500">
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="national_id">National ID</option>
                  <option value="state_id">State ID</option>
                </select>
                <input type="date" placeholder="ID Expiry" value={formData.government_id_expiry} onChange={(e) => setFormData((p) => ({ ...p, government_id_expiry: e.target.value }))} className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500" />
              </div>

              {/* Documents */}
              <div className="space-y-2 border-t border-slate-600 pt-2">
                <p className="text-xs text-blue-200 font-semibold">Documents (Optional)</p>
                {[
                    ['ID Front', 'id_front'],
                    ['ID Back', 'id_back'],
                    ['Selfie', 'selfie'],
                  ].map(([label, key]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      <label className="text-slate-300 flex-1">{label}</label>
                      <input
                        ref={fileRefs[key]}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleDocUpload(key, e.target.files?.[0])}
                        disabled={uploadingDocs[key]}
                        className="text-xs text-slate-400 file:bg-slate-600 file:border file:border-slate-500 file:rounded file:px-1.5 file:py-0.5 file:text-xs file:text-white cursor-pointer"
                      />
                      {uploadingDocs[key] && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                      {uploadedDocs[key] && <span className="text-emerald-400">✓</span>}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Existing Admin Notes */}
          {record.admin_notes && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-400 mb-1">Previous Admin Notes</p>
              <p className="text-xs text-slate-300">{record.admin_notes}</p>
            </div>
          )}

          {/* Check Again Fields Selection */}
          {actionMode === 'check_again' && (
            <div className="bg-purple-950/30 border border-purple-800/30 rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-purple-300">Select Fields to Recheck</p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {CHECKABLE_FIELDS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFields[key] || false}
                      onChange={(e) => setSelectedFields((p) => ({ ...p, [key]: e.target.checked }))}
                      className="w-3 h-3 accent-purple-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <textarea
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-white text-xs resize-none h-16 focus:outline-none focus:border-purple-500"
                placeholder="Optional message to user about what to correct..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
          )}

          {/* Note Input */}
          {actionMode && actionMode !== 'check_again' && (
            <div className="space-y-2">
              <textarea
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-xs resize-none h-20 focus:outline-none focus:border-blue-500"
                placeholder={
                  actionMode === 'deny' ? 'Reason for denial (required)...' :
                  actionMode === 'request' ? 'Describe what additional info is needed...' :
                  'Describe the suspicious activity or inconsistency...'
                }
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Mark Under Review */}
            {statusKey === 'submitted' && (
              <Button
                onClick={() => onAction(record.id, 'under_review', {})}
                variant="outline"
                className="text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10 col-span-2"
              >
                <Clock className="w-3 h-3 mr-1" /> Mark Under Review
              </Button>
            )}

            {/* Approve */}
            {['submitted', 'under_review', 'flagged', 'additional_info'].includes(statusKey) && (
              <Button
                onClick={() => onAction(record.id, 'approve', { note: noteText })}
                className="text-xs bg-emerald-600 hover:bg-emerald-500"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
              </Button>
            )}

            {/* Deny */}
            {['submitted', 'under_review', 'flagged', 'additional_info'].includes(statusKey) && (
              actionMode === 'deny' ? (
                <Button
                  onClick={() => { onAction(record.id, 'deny', { note: noteText }); setActionMode(null); setNoteText(''); }}
                  disabled={!noteText.trim()}
                  className="text-xs bg-red-600 hover:bg-red-500"
                >
                  <XCircle className="w-3 h-3 mr-1" /> Confirm Denial
                </Button>
              ) : (
                <Button
                  onClick={() => setActionMode('deny')}
                  variant="outline"
                  className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="w-3 h-3 mr-1" /> Deny
                </Button>
              )
            )}

            {/* Request More Info */}
            {['submitted', 'under_review', 'flagged'].includes(statusKey) && (
              actionMode === 'request' ? (
                <Button
                  onClick={() => { onAction(record.id, 'request_info', { note: noteText }); setActionMode(null); setNoteText(''); }}
                  disabled={!noteText.trim()}
                  className="text-xs bg-yellow-600 hover:bg-yellow-500"
                >
                  <MessageSquare className="w-3 h-3 mr-1" /> Send Request
                </Button>
              ) : (
                <Button
                  onClick={() => setActionMode('request')}
                  variant="outline"
                  className="text-xs border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                >
                  <MessageSquare className="w-3 h-3 mr-1" /> Request Info
                </Button>
              )
            )}

            {/* Flag as Suspicious */}
             {['submitted', 'under_review'].includes(statusKey) && (
               actionMode === 'flag' ? (
                 <Button
                   onClick={() => { onAction(record.id, 'flag', { note: noteText }); setActionMode(null); setNoteText(''); }}
                   disabled={!noteText.trim()}
                   className="text-xs bg-orange-600 hover:bg-orange-500"
                 >
                   <Flag className="w-3 h-3 mr-1" /> Confirm Flag
                 </Button>
               ) : (
                 <Button
                   onClick={() => setActionMode('flag')}
                   variant="outline"
                   className="text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                 >
                   <Flag className="w-3 h-3 mr-1" /> Flag Suspicious
                 </Button>
               )
             )}

             {/* Submit for User */}
             {actionMode === 'upload' ? (
               <Button
                 onClick={handleSubmitDocuments}
                 disabled={Object.keys(uploadedDocs).length === 0}
                 className="text-xs bg-blue-600 hover:bg-blue-500 col-span-2"
               >
                 <CheckCircle2 className="w-3 h-3 mr-1" /> Submit Documents
               </Button>
             ) : (
               <Button
                 onClick={() => setActionMode('upload')}
                 variant="outline"
                 className="text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10 col-span-2"
               >
                 <Upload className="w-3 h-3 mr-1" /> Submit for User
               </Button>
             )}

             {/* Check Again */}
             {actionMode === 'check_again' ? (
               <Button
                 onClick={handleCheckAgain}
                 className="text-xs bg-purple-600 hover:bg-purple-500 col-span-2"
               >
                 <MessageSquare className="w-3 h-3 mr-1" /> Send Check Again Request
               </Button>
             ) : (
               ['submitted', 'under_review'].includes(statusKey) && (
                 <Button
                   onClick={() => setActionMode('check_again')}
                   variant="outline"
                   className="text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 col-span-2"
                 >
                   <MessageSquare className="w-3 h-3 mr-1" /> Check Again
                 </Button>
               )
             )}
          </div>

          {actionMode && (
            <button onClick={() => { setActionMode(null); setNoteText(''); }} className="text-xs text-slate-500 hover:text-slate-300 w-full text-center">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KYCAdminQueue() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('pending');

  const { data: allKYC = [], isLoading, refetch } = useQuery({
    queryKey: ['kyc-admin-all'],
    queryFn: async () => {
      const res = await base44.functions.invoke('kycAdminService', { action: 'list' });
      return res.data?.records || [];
    },
    initialData: [],
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, note, docUpdates }) => {
      const fields = docUpdates?.fields || [];
      const now = new Date().toISOString();
      const updates = { admin_notes: note || undefined };

      if (action === 'approve') {
        Object.assign(updates, {
          status: 'approved',
          admin_status: 'approved',
          approved_at: now,
          verified_at: now,
          user_approved_for_autopilot: true,
          allowed_modules: ['financial_onboarding', 'payment_payout', 'prize_claiming', 'tax_compliance', 'government_compliance'],
          admin_denial_reason: null,
          admin_request_note: null,
        });
      } else if (action === 'deny') {
        Object.assign(updates, {
          status: 'rejected',
          admin_status: 'rejected',
          rejection_reason: note,
          admin_denial_reason: note,
          user_approved_for_autopilot: false,
          allowed_modules: [],
        });
      } else if (action === 'under_review') {
        Object.assign(updates, { status: 'under_review', admin_status: 'under_review' });
      } else if (action === 'request_info') {
        Object.assign(updates, { status: 'submitted', admin_status: 'additional_info', admin_request_note: note });
      } else if (action === 'flag') {
        Object.assign(updates, { admin_status: 'flagged', admin_notes: `[FLAGGED] ${note}` });
      } else if (action === 'submit_docs') {
        Object.assign(updates, {
          ...docUpdates,
          status: 'submitted',
          admin_status: 'submitted',
          admin_notes: 'Documents uploaded by admin'
        });
      } else if (action === 'check_again') {
        Object.assign(updates, {
          status: 'submitted',
          admin_status: 'check_again_required',
          admin_request_note: note || 'Please review and correct the selected fields.',
          check_again_fields: docUpdates?.fields || [],
        });
      }

      // Append to access log via service role
      const logRes = await base44.functions.invoke('kycAdminService', { action: 'get_access_log', id });
      const existingLog = logRes.data?.access_log || [];
      updates.access_log = [...existingLog, {
        accessed_at: now,
        accessed_by: 'admin',
        purpose: action,
        module: 'kyc_admin_review',
      }];

      return base44.functions.invoke('kycAdminService', { action: 'update', id, updates });
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-admin-all'] });
      queryClient.invalidateQueries({ queryKey: ['kyc'] });
      const messages = {
        approve: '✅ KYC approved',
        deny: '❌ KYC denied',
        under_review: '🔍 Marked under review',
        request_info: '📋 Additional info requested',
        flag: '🚩 Submission flagged',
        submit_docs: '📤 Documents submitted for user',
        check_again: '🔄 User requested to check again',
      };
      toast.success(messages[action] || 'Updated');
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const handleAction = (id, action, { note, docUpdates, fields } = {}) => {
    actionMutation.mutate({ id, action, note, docUpdates: { ...docUpdates, fields } });
  };

  const filtered = allKYC.filter(r => {
    const s = r.admin_status || r.status;
    if (statusFilter === 'pending') return ['submitted', 'under_review', 'additional_info'].includes(s);
    if (statusFilter === 'flagged') return s === 'flagged';
    if (statusFilter === 'approved') return s === 'approved';
    if (statusFilter === 'denied') return s === 'rejected';
    return true;
  });

  const counts = {
    pending:  allKYC.filter(r => ['submitted', 'under_review', 'additional_info'].includes(r.admin_status || r.status)).length,
    flagged:  allKYC.filter(r => (r.admin_status || r.status) === 'flagged').length,
    approved: allKYC.filter(r => (r.admin_status || r.status) === 'approved').length,
    denied:   allKYC.filter(r => (r.admin_status || r.status) === 'rejected').length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            KYC Review Queue
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manual human verification · All decisions are logged</p>
        </div>
        <Button onClick={() => refetch()} variant="ghost" size="sm" className="text-slate-400">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: 'pending',  label: 'Pending',  color: 'text-blue-400',    count: counts.pending },
          { key: 'flagged',  label: 'Flagged',  color: 'text-orange-400',  count: counts.flagged },
          { key: 'approved', label: 'Approved', color: 'text-emerald-400', count: counts.approved },
          { key: 'denied',   label: 'Denied',   color: 'text-red-400',     count: counts.denied },
        ].map(({ key, label, color, count }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`bg-slate-900 border rounded-lg p-3 text-center transition-colors ${statusFilter === key ? 'border-slate-500' : 'border-slate-800 hover:border-slate-700'}`}
          >
            <p className={`text-xl font-bold ${color}`}>{count}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </button>
        ))}
      </div>

      {/* All filter */}
      <div className="flex gap-1">
        {['pending', 'flagged', 'approved', 'denied', 'all'].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs capitalize border transition-colors ${statusFilter === f ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Review Queue */}
      {isLoading ? (
        <p className="text-slate-500 text-sm text-center py-8">Loading submissions...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Shield className="w-10 h-10 mx-auto mb-3 text-slate-700" />
          <p className="text-sm">No {statusFilter} submissions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => (
            <KYCReviewCard key={record.id} record={record} onAction={handleAction} />
          ))}
        </div>
      )}
    </div>
  );
}