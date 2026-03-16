import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Comprehensive test suite for user data persistence system
 * Validates all components work together correctly
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`\n=== PERSISTENCE SYSTEM TEST ===`);
    console.log(`Testing for user: ${user.email}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const results = {
      test_timestamp: new Date().toISOString(),
      user_email: user.email,
      tests_passed: 0,
      tests_failed: 0,
      details: [],
    };

    // Test 1: UserDataStore Creation/Fetch
    console.log('TEST 1: UserDataStore Creation/Fetch');
    try {
      let stores = await base44.entities.UserDataStore.filter(
        { user_email: user.email },
        '-created_date',
        1
      );

      if (!stores || !stores[0]) {
        // Create default store
        const newStore = await base44.entities.UserDataStore.create({
          user_email: user.email,
          autopilot_preferences: { enabled: false },
          ui_preferences: { theme: 'dark' },
          identity_preferences: { auto_switch_identities: false },
          security_preferences: { two_factor_enabled: true },
          wallet_preferences: { payout_frequency: 'weekly' },
          execution_rules: { skip_opportunities_with_captcha: true },
        });
        stores = [newStore];
      }

      if (stores && stores[0]) {
        results.tests_passed++;
        results.details.push({
          test: 'UserDataStore Creation/Fetch',
          status: 'PASS',
          store_id: stores[0].id,
        });
        console.log('✅ PASS: UserDataStore exists or created\n');
      } else {
        throw new Error('Failed to create or fetch store');
      }
    } catch (error) {
      results.tests_failed++;
      results.details.push({
        test: 'UserDataStore Creation/Fetch',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`❌ FAIL: ${error.message}\n`);
    }

    // Test 2: Data Persistence via updateField
    console.log('TEST 2: Data Persistence via updateField');
    try {
      const updateResult = await base44.functions.invoke(
        'userDataPersistenceManager',
        {
          action: 'update',
          field: 'autopilot_preferences',
          value: { enabled: true, mode: 'continuous' },
        }
      );

      if (updateResult.data?.success) {
        results.tests_passed++;
        results.details.push({
          test: 'Data Persistence',
          status: 'PASS',
          field: 'autopilot_preferences',
        });
        console.log('✅ PASS: Data update persisted\n');
      } else {
        throw new Error('Update returned unsuccessful');
      }
    } catch (error) {
      results.tests_failed++;
      results.details.push({
        test: 'Data Persistence',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`❌ FAIL: ${error.message}\n`);
    }

    // Test 3: Checksum Validation
    console.log('TEST 3: Checksum Validation');
    try {
      const integrityResult = await base44.functions.invoke(
        'userDataPersistenceManager',
        {
          action: 'validate_integrity',
        }
      );

      if (integrityResult.data?.valid) {
        results.tests_passed++;
        results.details.push({
          test: 'Checksum Validation',
          status: 'PASS',
          message: integrityResult.data?.message,
        });
        console.log('✅ PASS: Data integrity verified\n');
      } else {
        throw new Error('Integrity check failed');
      }
    } catch (error) {
      results.tests_failed++;
      results.details.push({
        test: 'Checksum Validation',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`❌ FAIL: ${error.message}\n`);
    }

    // Test 4: Audit Log Creation
    console.log('TEST 4: Audit Log Creation');
    try {
      const auditEntries = await base44.entities.UserDataAuditLog.filter(
        { user_email: user.email },
        '-created_date',
        5
      );

      if (auditEntries && auditEntries.length > 0) {
        results.tests_passed++;
        results.details.push({
          test: 'Audit Log Creation',
          status: 'PASS',
          audit_count: auditEntries.length,
        });
        console.log(`✅ PASS: ${auditEntries.length} audit entries exist\n`);
      } else {
        throw new Error('No audit entries found');
      }
    } catch (error) {
      results.tests_failed++;
      results.details.push({
        test: 'Audit Log Creation',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`❌ FAIL: ${error.message}\n`);
    }

    // Test 5: Autopilot Persistence Sync
    console.log('TEST 5: Autopilot Persistence Sync');
    try {
      const syncResult = await base44.functions.invoke(
        'autopilotPersistenceSync',
        {}
      );

      if (syncResult.data?.preferences) {
        results.tests_passed++;
        results.details.push({
          test: 'Autopilot Persistence Sync',
          status: 'PASS',
          preferences_loaded: Object.keys(syncResult.data.preferences).length,
        });
        console.log('✅ PASS: Autopilot can load persistent preferences\n');
      } else {
        throw new Error('Sync failed to return preferences');
      }
    } catch (error) {
      results.tests_failed++;
      results.details.push({
        test: 'Autopilot Persistence Sync',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`❌ FAIL: ${error.message}\n`);
    }

    // Test 6: Reset Field
    console.log('TEST 6: Reset Field to Defaults');
    try {
      const resetResult = await base44.functions.invoke(
        'userDataPersistenceManager',
        {
          action: 'reset',
          field: 'ui_preferences',
        }
      );

      if (resetResult.data?.success) {
        results.tests_passed++;
        results.details.push({
          test: 'Reset Field',
          status: 'PASS',
          field: 'ui_preferences',
        });
        console.log('✅ PASS: Field reset to defaults\n');
      } else {
        throw new Error('Reset failed');
      }
    } catch (error) {
      results.tests_failed++;
      results.details.push({
        test: 'Reset Field',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`❌ FAIL: ${error.message}\n`);
    }

    // Test 7: Read Field
    console.log('TEST 7: Read Persisted Data');
    try {
      const readResult = await base44.functions.invoke(
        'userDataPersistenceManager',
        {
          action: 'read',
          field: 'autopilot_preferences',
        }
      );

      if (readResult.data?.value) {
        results.tests_passed++;
        results.details.push({
          test: 'Read Persisted Data',
          status: 'PASS',
          value: readResult.data.value,
        });
        console.log('✅ PASS: Can read persisted data\n');
      } else {
        throw new Error('Failed to read data');
      }
    } catch (error) {
      results.tests_failed++;
      results.details.push({
        test: 'Read Persisted Data',
        status: 'FAIL',
        error: error.message,
      });
      console.log(`❌ FAIL: ${error.message}\n`);
    }

    // Summary
    console.log('=== TEST SUMMARY ===');
    console.log(`Total Tests: ${results.tests_passed + results.tests_failed}`);
    console.log(`Passed: ${results.tests_passed} ✅`);
    console.log(`Failed: ${results.tests_failed} ❌`);
    console.log(
      `Success Rate: ${Math.round((results.tests_passed / (results.tests_passed + results.tests_failed)) * 100)}%\n`
    );

    if (results.tests_failed === 0) {
      console.log('🎉 ALL TESTS PASSED - System is fully functional!\n');
    } else {
      console.log(`⚠️  ${results.tests_failed} test(s) failed - review details above\n`);
    }

    return Response.json(results);
  } catch (error) {
    console.error('Test suite error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});