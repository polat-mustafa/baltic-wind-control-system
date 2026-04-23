/**
 * Market Integration Dashboard — M11.
 *
 * Three panels:
 *   1. DA bid schedule (24h bar + price line)
 *   2. Revenue waterfall (DA + CfD + ancillary − imbalance)
 *   3. Ancillary services portfolio (FCR-N, FCR-D, aFRR, mFRR)
 *
 * Markets: TGE day-ahead, PSE ancillary (BSP), Polish CfD (OZMB 2024).
 */

import { useEffect } from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";

import { useMarketStore } from "../../store/marketStore";
import { Button } from "../ui/Button";
import DABidPanel from "./DABidPanel";
import RevenueBreakdownPanel from "./RevenueBreakdownPanel";
import ImbalanceSettlementPanel from "./ImbalanceSettlementPanel";
import { InfoButton } from "../ui/InfoButton";
import { marketDashboardInfo, ancillaryServicesInfo } from "../../constants/panelInfo";

export default function MarketDashboard() {
  const {
    ancillaryResult,
    loading,
    error,
    includeBessArbitrage,
    runAll,
    setIncludeBessArbitrage,
    clearError,
  } = useMarketStore();

  useEffect(() => {
    runAll();
  }, [runAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin mr-2" />
        Running market analysis…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-status-alarm/10 border border-status-alarm/30 rounded-lg text-sm flex justify-between">
          <span className="text-status-alarm flex items-center gap-2"><AlertTriangle size={14} /> {error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-accent" />
          <span className="text-sm font-semibold text-text-primary">Market Integration — TGE / PSE / CfD (OZMB 2024)</span>
          <InfoButton info={marketDashboardInfo} />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={includeBessArbitrage}
              onChange={(e) => setIncludeBessArbitrage(e.target.checked)}
              className="accent-accent"
            />
            BESS arbitrage
          </label>
          <Button size="sm" onClick={runAll} disabled={loading}>Refresh</Button>
        </div>
      </div>

      {/* DA bid + revenue */}
      <DABidPanel />

      {/* Imbalance settlement (M11 endpoint, previously orphaned from UI) */}
      <ImbalanceSettlementPanel />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RevenueBreakdownPanel />

        {/* Ancillary services */}
        {ancillaryResult && (
          <div className="bg-bg-secondary rounded-lg border border-border-primary p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold text-text-primary">Ancillary Services Portfolio (PSE BSP)</h3>
                <InfoButton info={ancillaryServicesInfo} />
              </div>
              <span className="text-xs font-mono text-text-primary">{(ancillaryResult.bsp_contract_value_m_eur_year).toFixed(1)} M€/yr</span>
            </div>
            <div className="space-y-2">
              {ancillaryResult.services.map((svc) => (
                <div key={svc.service} className="flex items-center justify-between text-xs py-1.5 border-b border-border-primary/40 last:border-0">
                  <span className="font-mono text-text-primary">{svc.service}</span>
                  <span className="text-text-secondary">{svc.capacity_mw.toFixed(0)} MW</span>
                  <span className="text-text-muted">{svc.availability_price_eur_mw_h.toFixed(1)} €/MW/h</span>
                  <span className="font-mono text-text-primary">{(svc.annual_revenue_eur / 1_000_000).toFixed(2)} M€/yr</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-muted">{ancillaryResult.assessment}</p>
          </div>
        )}
      </div>
    </div>
  );
}
