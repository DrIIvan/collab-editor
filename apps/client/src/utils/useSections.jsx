import { useEffect, useMemo, useState } from "react";

export function useSections(yDoc, provider) {
  const yArr = useMemo(() => yDoc.getArray("sections"), [yDoc]);
  const [ids, setIds] = useState(() => [...new Set(yArr.toArray())]);

  useEffect(() => {
    const update = () => setIds([...new Set(yArr.toArray())]); // Set защищает от дублей при гонке
    yArr.observe(update);

    // Инициализируем только после синхронизации, иначе затрём чужой список
    const init = (synced = provider.synced) => {
      if (!synced) return;
      if (yArr.length === 0) yArr.push(["default"]);
      update();
    };
    provider.on("sync", init);
    init();

    return () => {
      yArr.unobserve(update);
      provider.off("sync", init);
    };
  }, [yArr, provider]);

  return [ids, yArr];
}