import VaultLoadingVisual from "@/components/vault-loading-visual";

export default function TheVaultLoading() {
  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-black">
<VaultLoadingVisual
  progress={null}
  animateWheel={false}
  blackout={false}
/>
    </div>
  );
}
