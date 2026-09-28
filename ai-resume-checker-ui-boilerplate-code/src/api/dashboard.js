import { resumesApi } from "./resumes";

export const dashboardApi = {
  get: async () => {
    const response = await resumesApi.list();
    const resumes = response.resumes || [];

    const sortedResumes = [...resumes].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt) -
        new Date(a.updatedAt || a.createdAt)
    );

    return {
      totals: {
        resumes: resumes.length,
        rewrites: 0,
        analyses: 0,
      },

      latestResume: sortedResumes[0] || null,

      scoreSeries: [],
      versionStack: [],
      activity: [],

      kpi: {
        versions: {
          value: "—",
          spark: [],
        },
      },
    };
  },
};