"use client";

import { useEffect, useState } from "react";
import { isAiConfigured, runAiTask } from "../../ai/api-client";
import type { StockItem } from "../../data/types";
import { forecastInput, ruleForecast, type Forecast, type ForecastInput } from "../../stock/forecast";
import { useStudio } from "../use-studio";

const aiForecasts = new Map<string, Forecast>();

/** Days left per product. Rules answer at once; the `stock-forecast` AI task replaces them when a key is configured. */
export function useForecasts(items: StockItem[]): Forecast[] {
  const { state, today } = useStudio();
  const localOnly = !!state.industry;
  const inputs = items.map((item) => forecastInput(state, item, today));
  const key = JSON.stringify(inputs);
  const [, refresh] = useState(0);

  useEffect(() => {
    const missing = (JSON.parse(key) as ForecastInput[]).filter((input) => !aiForecasts.has(JSON.stringify(input)));
    if (!missing.length) return;
    let current = true;
    isAiConfigured(localOnly)
      .then((configured) => (configured ? Promise.all(missing.map((input) => runAiTask<Forecast>("stock-forecast", input, localOnly))) : []))
      .then((results) => {
        results.forEach((result, i) => {
          if (result.log.source === "ai") aiForecasts.set(JSON.stringify(missing[i]), result.output);
        });
        if (current && results.length) refresh((n) => n + 1);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [key, localOnly]);

  return inputs.map((input) => (localOnly ? undefined : aiForecasts.get(JSON.stringify(input))) ?? ruleForecast(input));
}
