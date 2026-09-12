export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;
  const sdkPackage = "@opentelemetry/sdk-node";
  const traceExporterPackage = "@opentelemetry/exporter-trace-otlp-http";
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<unknown>;
  try {
    const { NodeSDK } = await dynamicImport(sdkPackage) as { NodeSDK: new (options: Record<string, unknown>) => { start: () => void } };
    const { OTLPTraceExporter } = await dynamicImport(traceExporterPackage) as { OTLPTraceExporter: new (options: Record<string, unknown>) => unknown };
    const sdk = new NodeSDK({
      serviceName: process.env.OTEL_SERVICE_NAME ?? "repodeck",
      traceExporter: new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, "")}/v1/traces` })
    });
    sdk.start();
  } catch {
    console.warn(`[repodeck] OTEL_EXPORTER_OTLP_ENDPOINT is set but OpenTelemetry packages are not installed. Run: npm install ${sdkPackage} ${traceExporterPackage}`);
  }
}
