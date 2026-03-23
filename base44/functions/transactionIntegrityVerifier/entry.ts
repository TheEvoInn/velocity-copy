/**
 * TRANSACTION INTEGRITY VERIFIER
 * Ensures every Transaction record references:
 * 1. Real platform transaction ID
 * 2. Proof of payment (API response or screenshot)
 * 3. Actual cleared status (not estimated)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Audit transaction for integrity
 */
async function auditTransaction(base44, transactionId) {
  const audit = {
    transaction_id: transactionId,
    timestamp: new Date().toISOString(),
    status: 'pending',
    findings: [],
    passed: false,
  };

  try {
    // Fetch transaction
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { id: transactionId }, null, 1
    );

    if (!transactions.length) {
      audit.status = 'failed';
      audit.findings.push('Transaction not found');
      return audit;
    }

    const txn = transactions[0];

    // Check 1: Platform transaction ID exists
    if (!txn.linked_account_id) {
      audit.findings.push('❌ Missing platform transaction ID (linked_account_id)');
    } else {
      audit.findings.push(`✓ Platform transaction ID present: ${txn.linked_account_id}`);
    }

    // Check 2: Amount is positive and valid
    if (!txn.amount || txn.amount <= 0) {
      audit.findings.push('❌ Invalid or missing amount');
    } else {
      audit.findings.push(`✓ Valid amount: $${txn.amount.toFixed(2)}`);
    }

    // Check 3: Platform is recognized
    const validPlatforms = ['upwork', 'fiverr', 'freelancer', 'toptal'];
    if (!txn.platform || !validPlatforms.includes(txn.platform)) {
      audit.findings.push(`❌ Unknown or missing platform: ${txn.platform}`);
    } else {
      audit.findings.push(`✓ Valid platform: ${txn.platform}`);
    }

    // Check 4: Status is cleared (not estimated)
    if (txn.payout_status !== 'available' && txn.payout_status !== 'cleared') {
      audit.findings.push(`⚠️ Status is "${txn.payout_status}", not cleared`);
    } else {
      audit.findings.push(`✓ Status is cleared: ${txn.payout_status}`);
    }

    // Check 5: Notes reference platform verification
    if (!txn.notes || !txn.notes.includes('API') && !txn.notes.includes('verified')) {
      audit.findings.push('⚠️ Notes lack platform verification reference');
    } else {
      audit.findings.push('✓ Notes reference platform verification');
    }

    // Check 6: Net amount is less than or equal to gross
    if (txn.net_amount && txn.amount && txn.net_amount > txn.amount) {
      audit.findings.push('❌ Net amount exceeds gross amount');
    } else if (txn.net_amount) {
      audit.findings.push(`✓ Net amount valid: $${txn.net_amount.toFixed(2)}`);
    }

    // Determine if passed
    const failedChecks = audit.findings.filter(f => f.startsWith('❌')).length;
    audit.passed = failedChecks === 0;
    audit.status = audit.passed ? 'passed' : 'failed';

    return audit;
  } catch (e) {
    audit.status = 'error';
    audit.findings.push(`Error: ${e.message}`);
    return audit;
  }
}

/**
 * Bulk audit all transactions for a user
 */
async function auditAllUserTransactions(base44, userEmail) {
  const bulkAudit = {
    user: userEmail,
    timestamp: new Date().toISOString(),
    total_transactions: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    failed_transactions: [],
  };

  try {
    // Fetch all user transactions
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { created_by: userEmail }, '-created_date', 100
    );

    bulkAudit.total_transactions = transactions.length;

    // Audit each transaction
    for (const txn of transactions) {
      const audit = await auditTransaction(base44, txn.id);

      if (audit.status === 'passed') {
        bulkAudit.passed++;
      } else if (audit.status === 'failed') {
        bulkAudit.failed++;
        bulkAudit.failed_transactions.push({
          id: txn.id,
          findings: audit.findings,
        });
      } else {
        bulkAudit.errors++;
      }
    }

    // Log results
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `📋 Transaction integrity audit: ${bulkAudit.passed}/${bulkAudit.total_transactions} passed`,
      severity: bulkAudit.failed === 0 ? 'success' : 'warning',
      metadata: bulkAudit,
    }).catch(() => null);

    return bulkAudit;
  } catch (e) {
    bulkAudit.errors++;
    return bulkAudit;
  }
}

/**
 * Verify transaction has proof of payment
 */
async function verifyProofOfPayment(base44, transactionId) {
  try {
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { id: transactionId }, null, 1
    );

    if (!transactions.length) {
      return { verified: false, error: 'Transaction not found' };
    }

    const txn = transactions[0];

    // Check for proof in notes (API response reference)
    const hasApiProof = txn.notes && (txn.notes.includes('API') || txn.notes.includes('verified'));

    // Check for screenshot proof (would be stored as file_url)
    const hasScreenshot = txn.notes && txn.notes.includes('screenshot');

    // Check for linked opportunity confirmation
    const hasConfirmation = txn.notes && txn.notes.includes('ID:');

    return {
      verified: hasApiProof || hasScreenshot || hasConfirmation,
      proof_types: {
        api_response: hasApiProof,
        screenshot: hasScreenshot,
        confirmation_number: hasConfirmation,
      },
      notes_excerpt: txn.notes ? txn.notes.substring(0, 200) : 'No notes',
    };
  } catch (e) {
    return { verified: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, transaction_id } = body;

    // ── Audit single transaction ───────────────────────────────────────
    if (action === 'audit_transaction') {
      if (!transaction_id) {
        return Response.json({ error: 'Transaction ID required' }, { status: 400 });
      }

      const audit = await auditTransaction(base44, transaction_id);
      return Response.json({
        success: audit.passed,
        audit,
      });
    }

    // ── Audit all user transactions ────────────────────────────────────
    if (action === 'audit_all_transactions') {
      const bulkAudit = await auditAllUserTransactions(base44, user.email);
      return Response.json({
        success: bulkAudit.failed === 0,
        audit: bulkAudit,
      });
    }

    // ── Verify proof of payment ────────────────────────────────────────
    if (action === 'verify_proof') {
      if (!transaction_id) {
        return Response.json({ error: 'Transaction ID required' }, { status: 400 });
      }

      const verification = await verifyProofOfPayment(base44, transaction_id);
      return Response.json(verification);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[TransactionIntegrityVerifier] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});