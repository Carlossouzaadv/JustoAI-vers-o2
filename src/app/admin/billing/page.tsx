'use client';

import { useEffect, useState } from 'react';
import { ICONS } from '@/lib/icons';

interface WorkspaceBillingInfo {
  id: string;
  name: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
  daysUntilTrialExpires: number | null;
  credits: {
    reportCreditsBalance: number;
    fullCreditsBalance: number;
    totalBalance: number;
  };
  users: {
    count: number;
    admin: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface BillingSummary {
  totalWorkspaces: number;
  byPlan: Record<string, number>;
  byStatus: Record<string, number>;
  trialsExpiringIn7Days: number;
  totalCreditsAllocated: number;
}

interface AddCreditsState {
  workspaceId: string | null;
  amount: string;
  reason: string;
  isLoading: boolean;
  error: string | null;
}

const PLAN_COLORS: Record<string, string> = {
  TRIAL: 'bg-yellow-100 text-yellow-800',
  FREE: 'bg-gray-100 text-gray-800',
  GESTAO: 'bg-blue-100 text-blue-800',
  PERFORMANCE: 'bg-purple-100 text-purple-800',
  ENTERPRISE: 'bg-red-100 text-red-800'
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-red-100 text-red-800',
  DELETED: 'bg-black text-white'
};

export default function AdminBillingPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceBillingInfo[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPlan, setFilterPlan] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [addCreditsState, setAddCreditsState] = useState<AddCreditsState>({
    workspaceId: null,
    amount: '',
    reason: '',
    isLoading: false,
    error: null
  });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch billing data
  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (filterPlan !== 'ALL') params.append('plan', filterPlan);
        if (searchTerm) params.append('search', searchTerm);

        const response = await fetch(`/api/admin/billing/workspaces?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch billing data');
        }

        const json = await response.json();

        if (json.success) {
          setWorkspaces(json.data.workspaces);
          setSummary(json.data.summary);
        } else {
          setError(json.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchBillingData, 300); // Debounce
    return () => clearTimeout(timer);
  }, [filterPlan, searchTerm]);

  const handleAddCreditsClick = (workspaceId: string) => {
    setAddCreditsState({
      workspaceId,
      amount: '',
      reason: '',
      isLoading: false,
      error: null
    });
    setShowAddCreditsModal(true);
  };

  const handleAddCredits = async () => {
    if (!addCreditsState.workspaceId || !addCreditsState.amount || !addCreditsState.reason) {
      setAddCreditsState(prev => ({
        ...prev,
        error: 'All fields required'
      }));
      return;
    }

    try {
      setAddCreditsState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/admin/credits/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: addCreditsState.workspaceId,
          amount: parseFloat(addCreditsState.amount),
          category: 'FULL',
          reason: addCreditsState.reason
        })
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to add credits');
      }

      setSuccessMessage(`✅ Added ${addCreditsState.amount} credits to workspace`);
      setShowAddCreditsModal(false);

      // Refresh data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      setAddCreditsState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error',
        isLoading: false
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading billing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          💳 Admin Billing Dashboard
        </h1>
        <p className="text-gray-600 mt-2">Manage workspaces, credits, and subscription plans</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {ICONS.ERROR} {error}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          {successMessage}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Workspaces</p>
            <p className="text-2xl font-bold text-gray-900">{summary.totalWorkspaces}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Trials Expiring in 7 Days</p>
            <p className="text-2xl font-bold text-yellow-600">{summary.trialsExpiringIn7Days}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Active Workspaces</p>
            <p className="text-2xl font-bold text-green-600">{summary.byStatus.ACTIVE}</p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Credits Allocated</p>
            <p className="text-2xl font-bold text-blue-600">{Math.round(summary.totalCreditsAllocated)}</p>
          </div>
        </div>
      )}

      {/* Plan Distribution */}
      {summary && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Distribution by Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">TRIAL</p>
              <p className="text-lg font-bold text-yellow-600">{summary.byPlan.TRIAL}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">FREE</p>
              <p className="text-lg font-bold text-gray-600">{summary.byPlan.FREE}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">GESTÃO</p>
              <p className="text-lg font-bold text-blue-600">{summary.byPlan.GESTAO}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">PERFORMANCE</p>
              <p className="text-lg font-bold text-purple-600">{summary.byPlan.PERFORMANCE}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">ENTERPRISE</p>
              <p className="text-lg font-bold text-red-600">{summary.byPlan.ENTERPRISE}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <option value="ALL">All Plans</option>
          <option value="TRIAL">Trial</option>
          <option value="FREE">Free</option>
          <option value="GESTAO">Gestão</option>
          <option value="PERFORMANCE">Performance</option>
          <option value="ENTERPRISE">Enterprise</option>
        </select>

        <input
          type="text"
          placeholder="Search workspace..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Workspaces Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Workspace</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Total Credits</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Trial Ends</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Admin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {workspaces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No workspaces found
                  </td>
                </tr>
              ) : (
                workspaces.map((workspace) => (
                  <tr key={workspace.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{workspace.name}</p>
                        <p className="text-xs text-gray-500">{workspace.id}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${PLAN_COLORS[workspace.plan] || 'bg-gray-100'}`}>
                        {workspace.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[workspace.status] || 'bg-gray-100'}`}>
                        {workspace.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <p className="font-medium text-gray-900">{workspace.credits.totalBalance}</p>
                        <p className="text-xs text-gray-500">
                          {workspace.credits.reportCreditsBalance} report + {workspace.credits.fullCreditsBalance} full
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {workspace.plan === 'TRIAL' && workspace.trialEndsAt ? (
                        <div>
                          <p className={workspace.daysUntilTrialExpires !== null && workspace.daysUntilTrialExpires <= 7 ? 'text-red-600 font-medium' : 'text-gray-900'}>
                            {workspace.daysUntilTrialExpires} days
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(workspace.trialEndsAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <p className="font-medium text-gray-900">{workspace.users.count}</p>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {workspace.users.admin ? (
                        <p className="text-gray-700 max-w-xs truncate">{workspace.users.admin}</p>
                      ) : (
                        <span className="text-gray-400">No admin</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => handleAddCreditsClick(workspace.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        title="Add credits to this workspace"
                      >
                        {ICONS.PLUS} Add Credits
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Credits Modal */}
      {showAddCreditsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Credits to Workspace</h2>
            </div>

            <div className="p-6 space-y-4">
              {addCreditsState.error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
                  {ICONS.ERROR} {addCreditsState.error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workspace ID
                </label>
                <input
                  type="text"
                  value={addCreditsState.workspaceId || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Credits Amount
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={addCreditsState.amount}
                  onChange={(e) =>
                    setAddCreditsState(prev => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason
                </label>
                <input
                  type="text"
                  value={addCreditsState.reason}
                  onChange={(e) =>
                    setAddCreditsState(prev => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="e.g., Special promotion, Support credit"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAddCreditsModal(false)}
                disabled={addCreditsState.isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCredits}
                disabled={addCreditsState.isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {addCreditsState.isLoading ? 'Adding...' : 'Add Credits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
