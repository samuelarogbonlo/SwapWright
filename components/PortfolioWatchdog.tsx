'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import {
  getUserAccountData,
  generateHealthAlert,
  calculateMinRepaymentNeeded,
  type UserAccountData,
  type HealthAlert,
} from '@/lib/aave';

// Mock data for demo mode
const DEMO_DATA: UserAccountData = {
  totalCollateralUSD: 1000,
  totalDebtUSD: 650,
  availableBorrowsUSD: 150,
  currentLiquidationThreshold: 0.825, // 82.5%
  ltv: 0.75, // 75%
  healthFactor: 1.35, // Warning tier
};

export function PortfolioWatchdog() {
  const { address, isConnected } = useAccount();
  const [accountData, setAccountData] = useState<UserAccountData | null>(null);
  const [alert, setAlert] = useState<HealthAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // Fetch health data
  const fetchHealthData = async () => {
    if (!address || !isConnected) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getUserAccountData(address);
      setAccountData(data);
      setAlert(generateHealthAlert(data));
      setLastUpdate(new Date());

      // Auto-disable demo mode if real debt detected
      if (data.totalDebtUSD > 0 && demoMode) {
        setDemoMode(false);
      }
    } catch (err) {
      console.error('Failed to fetch Aave health data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Poll every 30 seconds
  useEffect(() => {
    if (!isConnected || !address) return;

    fetchHealthData();
    const interval = setInterval(fetchHealthData, 30000);

    return () => clearInterval(interval);
  }, [address, isConnected]);

  // Browser notification for critical alerts
  useEffect(() => {
    if (!alert || alert.tier === 'none' || alert.tier === 'safe') return;

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Send notification for warning/critical
    if (
      alert.tier === 'critical' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification('⚠️ Aave Liquidation Risk!', {
        body: `Health Factor: ${alert.healthFactor.toFixed(2)} - ${alert.message}`,
        icon: '/aave-logo.png',
        tag: 'aave-health',
      });
    }
  }, [alert]);

  if (!isConnected) {
    return null; // Don't show when wallet not connected
  }

  if (loading && !accountData) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-gray-400 text-sm">Loading Aave position...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-red-400 text-sm">Failed to load Aave data</span>
          <button
            onClick={fetchHealthData}
            className="text-blue-400 text-sm hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Determine what to display
  const hasRealPosition = alert && alert.tier !== 'none';
  const showDemoToggle = !hasRealPosition && !demoMode;

  // Use demo data if in demo mode, otherwise use real data
  const displayData = demoMode ? DEMO_DATA : accountData;
  const displayAlert = demoMode ? generateHealthAlert(DEMO_DATA) : alert;

  // Show demo toggle if no real position
  if (showDemoToggle) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400 text-sm">No Aave position detected</span>
          </div>
          <button
            onClick={() => setDemoMode(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
          >
            Show Sample Position
          </button>
        </div>
      </div>
    );
  }

  // Hide widget if no real position and not in demo mode
  if (!hasRealPosition && !demoMode) {
    return null;
  }

  const repaymentNeeded =
    displayData && displayAlert?.tier !== 'safe'
      ? calculateMinRepaymentNeeded(displayData, 2.0)
      : 0;

  return (
    <div
      className="border-2 rounded-lg p-4 shadow-lg transition-all"
      style={{
        backgroundColor: '#1F2937',
        borderColor: displayAlert?.color,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: displayAlert?.color }}
          ></div>
          <h3 className="text-white font-semibold">Portfolio Watchdog</h3>
          {demoMode && (
            <span className="px-2 py-0.5 bg-yellow-600/20 border border-yellow-600/40 text-yellow-400 text-xs rounded">
              DEMO MODE
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {demoMode && (
            <button
              onClick={() => setDemoMode(false)}
              className="text-gray-400 hover:text-white text-xs underline"
            >
              Exit Demo
            </button>
          )}
          <button
            onClick={fetchHealthData}
            disabled={loading || demoMode}
            className="text-gray-400 hover:text-white text-xs disabled:opacity-50"
          >
            {loading ? '...' : '🔄'}
          </button>
        </div>
      </div>

      {/* Health Factor Display */}
      <div className="mb-3">
        <div className="flex items-baseline space-x-2">
          <span className="text-gray-400 text-sm">Health Factor:</span>
          <span
            className="text-2xl font-bold"
            style={{ color: displayAlert?.color }}
          >
            {displayAlert?.healthFactor.toFixed(2)}
          </span>
        </div>
        <p className="text-sm mt-1" style={{ color: displayAlert?.color }}>
          {displayAlert?.message}
        </p>
      </div>

      {/* Position Stats */}
      {displayData && (
        <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
          <div>
            <span className="text-gray-400 block">Collateral</span>
            <span className="text-white font-medium">
              ${displayData.totalCollateralUSD.toFixed(2)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Debt</span>
            <span className="text-white font-medium">
              ${displayData.totalDebtUSD.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Suggested Actions */}
      {displayAlert?.suggestedAction && (
        <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
          <p className="text-gray-300 text-sm mb-2">{displayAlert.suggestedAction}</p>
          <div className="flex flex-col space-y-2 text-xs">
            {displayAlert.actionAmount && displayAlert.actionAmount > 0 && (
              <div className="text-gray-400">
                💰 Add collateral: <span className="text-white font-medium">${displayAlert.actionAmount.toFixed(2)}</span>
              </div>
            )}
            {repaymentNeeded > 0 && (
              <div className="text-gray-400">
                💸 Or repay debt: <span className="text-white font-medium">${repaymentNeeded.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Last Update */}
      {!demoMode && lastUpdate && (
        <div className="text-xs text-gray-500 text-right">
          Updated {new Date().getTime() - lastUpdate.getTime() < 60000
            ? 'just now'
            : `${Math.floor((new Date().getTime() - lastUpdate.getTime()) / 1000)}s ago`}
        </div>
      )}
      {demoMode && (
        <div className="text-xs text-yellow-400/60 text-right">
          This is sample data for demonstration purposes
        </div>
      )}
    </div>
  );
}
