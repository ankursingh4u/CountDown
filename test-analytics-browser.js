/**
 * Browser Console Test Script for Analytics
 *
 * Instructions:
 * 1. Open your shop's storefront (not admin)
 * 2. Open browser console (F12 → Console)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 */

(async function testAnalytics() {
  console.log('🧪 Testing Analytics Setup...\n');

  // Check if timer exists on page
  const timerElements = document.querySelectorAll('[data-timer-id]');
  console.log(`✅ Found ${timerElements.length} timer element(s) on page`);

  if (timerElements.length === 0) {
    console.error('❌ No timer elements found on page!');
    console.log('Make sure:');
    console.log('1. Timer is ACTIVE in admin');
    console.log('2. Theme block is installed');
    console.log('3. Timer is set to show on this page type');
    return;
  }

  timerElements.forEach((el, index) => {
    const timerId = el.dataset.timerId;
    const timerType = el.dataset.timerType;
    console.log(`\nTimer ${index + 1}:`);
    console.log(`  ID: ${timerId}`);
    console.log(`  Type: ${timerType}`);
    console.log(`  Element:`, el);
  });

  // Get first timer for testing
  const testTimer = timerElements[0];
  const testTimerId = testTimer.dataset.timerId;

  console.log(`\n📍 Testing with Timer ID: ${testTimerId}\n`);

  // Test 1: Check if debug endpoint is accessible
  console.log('Test 1: Checking debug endpoint...');
  try {
    const debugUrl = '/apps/timer/debug';
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();

    console.log('✅ Debug endpoint accessible');
    console.log('App Proxy Status:', debugData.appProxy?.configured ? '✅ WORKING' : '❌ NOT CONFIGURED');
    console.log('Shop Detected:', debugData.appProxy?.shopHeader || 'NOT FOUND');

    if (debugData.database) {
      console.log('Database Status:', debugData.database.status);
      console.log('Active Timers:', debugData.database.activeTimers || 0);
    }
  } catch (error) {
    console.error('❌ Debug endpoint failed:', error.message);
    console.log('This means app proxy is NOT configured correctly!');
  }

  // Test 2: Test analytics endpoint with GET
  console.log('\nTest 2: Checking analytics endpoint...');
  try {
    const analyticsUrl = '/apps/timer/analytics';
    const getResponse = await fetch(analyticsUrl);
    const getData = await getResponse.json();

    console.log('✅ Analytics endpoint accessible');
    console.log('Response:', getData);
  } catch (error) {
    console.error('❌ Analytics endpoint failed:', error.message);
  }

  // Test 3: Send test impression
  console.log('\nTest 3: Sending test impression...');
  try {
    const analyticsUrl = '/apps/timer/analytics';
    const payload = {
      event: 'impression',
      timerId: testTimerId,
      timestamp: Date.now(),
      url: window.location.href,
    };

    console.log('Payload:', payload);

    const response = await fetch(analyticsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Impression tracked successfully!');
      console.log('Response:', data);
      console.log('Current Impressions:', data.impressions || 'not returned');
      console.log('Current Clicks:', data.clicks || 'not returned');
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to track impression');
      console.error('Status:', response.status);
      console.error('Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }

  // Test 4: Send test click
  console.log('\nTest 4: Sending test click...');
  try {
    const analyticsUrl = '/apps/timer/analytics';
    const payload = {
      event: 'click',
      timerId: testTimerId,
      timestamp: Date.now(),
      url: window.location.href,
    };

    console.log('Payload:', payload);

    const response = await fetch(analyticsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Click tracked successfully!');
      console.log('Response:', data);
      console.log('Current Impressions:', data.impressions || 'not returned');
      console.log('Current Clicks:', data.clicks || 'not returned');
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to track click');
      console.error('Status:', response.status);
      console.error('Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }

  // Test 5: Verify specific timer in database
  console.log('\nTest 5: Checking timer in database...');
  try {
    const debugUrl = `/apps/timer/debug?timerId=${testTimerId}`;
    const response = await fetch(debugUrl);
    const data = await response.json();

    if (data.requestedTimer) {
      console.log('✅ Timer found in database');
      console.log('Timer Data:', data.requestedTimer);
    } else {
      console.error('❌ Timer not found in database!');
      console.log('This is the problem! Timer ID in metafield does not match database.');
    }
  } catch (error) {
    console.error('❌ Failed to check timer:', error.message);
  }

  console.log('\n✅ Diagnostic complete!');
  console.log('\nIf all tests passed but analytics are still zero:');
  console.log('1. Check server logs for analytics requests');
  console.log('2. Verify DATABASE_URL is correct');
  console.log('3. Check if timer was synced after creation');
})();
