import { MockDataSource } from "./mock/mockDataSource";
import type { LiveAnalyticsDataSource } from "./types";

/**
 * Single place that decides which data source the app uses.
 *
 * To connect real data, construct a different source here, e.g.:
 *
 *   const source = await new HttpBackendDataSource(import.meta.env.VITE_API_URL).init();
 *
 * No component imports a concrete source directly.
 */
let source: LiveAnalyticsDataSource = new MockDataSource();

export function getDataService(): LiveAnalyticsDataSource {
  return source;
}

export function setDataService(next: LiveAnalyticsDataSource) {
  source = next;
}

export type { LiveAnalyticsDataSource } from "./types";
export { MockDataSource } from "./mock/mockDataSource";
export { HttpBackendDataSource } from "./backend/httpBackendDataSource";
export { MetaGraphDataSource } from "./meta/metaGraphDataSource";
export { META_GRAPH_CAPABILITIES, AVAILABILITY_META, capabilityMap } from "./capabilities";
