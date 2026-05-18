import type { NativeSpec } from "@emulators/native-kit";

// Derived from examples/nango-seeds.yaml — the SDK-aligned seed slice for
// "zoho-crm", with each model's native collection path inferred from the
// seed rows' own url/self field. Regenerate via: node tools/gen-standalone.mjs
export const spec: NativeSpec = {
  name: "zoho-crm",
  tokenPath: "/oauth/v2/token",
  tokenPrefix: "zoho",
  connectionConfig: {
    api_domain: "https://www.zohoapis.com",
    portal: "acme",
  },
  models: [
    {
      model: "Leads",
      collectionPath: "/leadss",
      idField: "id",
      rows: [
        {
          id: "5429000001234567",
          First_Name: "Hannah",
          Last_Name: "Cohen",
          Email: "hannah@example.com",
          Lead_Source: "Web Download",
          Lead_Status: "Contacted",
          Company: "Aurora Labs",
          Owner: {
            id: "5429000000200001",
            name: "Priya Anand",
            email: "priya@acme.example",
          },
          Created_Time: "2025-10-22T11:00:00+00:00",
          Modified_Time: "2025-11-04T09:00:00+00:00",
        },
        {
          id: "5429000001234568",
          First_Name: "Ravi",
          Last_Name: "Patel",
          Email: "ravi@example.com",
          Lead_Source: "Trade Show",
          Lead_Status: "Not Contacted",
          Company: "Beacon Industrial",
          Owner: {
            id: "5429000000200001",
            name: "Priya Anand",
            email: "priya@acme.example",
          },
          Created_Time: "2025-11-08T15:24:00+00:00",
          Modified_Time: "2025-11-08T15:24:00+00:00",
        },
      ],
    },
  ],
};
