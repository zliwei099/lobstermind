import path from "node:path";
import { JsonFileStore } from "../storage/json-file-store.ts";
import type { NormalizedProviderId } from "../brain/runtime-target.ts";

export type AuthProfileMode = "api_key" | "oauth" | "token";

export interface AuthProfileRecord {
  id: string;
  provider: NormalizedProviderId;
  mode: AuthProfileMode;
  label?: string;
  apiKey?: string;
  token?: string;
  oauthAccount?: string;
  metadata?: Record<string, string>;
}

export interface AuthProfilesDocument {
  version: "auth-profiles.v1";
  defaultsByProvider: Partial<Record<NormalizedProviderId, string>>;
  items: AuthProfileRecord[];
}

const DEFAULT_DOCUMENT: AuthProfilesDocument = {
  version: "auth-profiles.v1",
  defaultsByProvider: {},
  items: []
};

export class AuthProfileStore {
  private readonly store: JsonFileStore<AuthProfilesDocument>;

  constructor(dataDir: string) {
    this.store = new JsonFileStore(path.join(dataDir, "auth-profiles.json"), DEFAULT_DOCUMENT);
  }

  read(): AuthProfilesDocument {
    const document = this.store.read();
    return {
      version: "auth-profiles.v1",
      defaultsByProvider: document.defaultsByProvider ?? {},
      items: Array.isArray(document.items) ? document.items : []
    };
  }

  list(): AuthProfileRecord[] {
    return this.read().items;
  }

  inspect(): AuthProfilesDocument {
    const document = this.read();
    return {
      version: document.version,
      defaultsByProvider: document.defaultsByProvider,
      items: document.items.map((item) => ({
        ...item,
        apiKey: item.apiKey ? "[redacted]" : undefined,
        token: item.token ? "[redacted]" : undefined
      }))
    };
  }

  get(profileId: string): AuthProfileRecord | undefined {
    return this.list().find((item) => item.id === profileId);
  }

  getDefaultProfile(provider: NormalizedProviderId): AuthProfileRecord | undefined {
    const document = this.read();
    const defaultProfileId = document.defaultsByProvider[provider];
    if (!defaultProfileId) {
      return undefined;
    }
    return document.items.find((item) => item.id === defaultProfileId && item.provider === provider);
  }

  upsert(profile: AuthProfileRecord): AuthProfileRecord {
    this.store.update((current) => {
      const items = current.items.filter((item) => item.id !== profile.id);
      return {
        version: "auth-profiles.v1",
        defaultsByProvider: current.defaultsByProvider ?? {},
        items: [...items, profile]
      };
    });
    return profile;
  }

  setDefaultProfile(provider: NormalizedProviderId, profileId: string): void {
    const profile = this.get(profileId);
    if (!profile) {
      throw new Error(`Unknown auth profile "${profileId}".`);
    }
    if (profile.provider !== provider) {
      throw new Error(`Auth profile "${profileId}" does not belong to provider "${provider}".`);
    }
    this.store.update((current) => ({
      version: "auth-profiles.v1",
      defaultsByProvider: {
        ...(current.defaultsByProvider ?? {}),
        [provider]: profileId
      },
      items: current.items
    }));
  }
}
