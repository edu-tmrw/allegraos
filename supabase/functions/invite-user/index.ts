import { createClient } from "@supabase/supabase-js";

export type OperationError = {
  code?: string;
  message?: string;
  status?: number;
};

export type OperationResult<T> =
  | { data: T; error: null }
  | { data: null; error: OperationError };

type CallerAccess = {
  active: boolean;
  manageSettings: boolean;
};

type InvitedUser = {
  id: string;
};

type NewProfile = {
  userId: string;
  name: string;
  roleId: string;
};

export interface CallerClient {
  getUser(): Promise<OperationResult<{ id: string } | null>>;
  getAccess(userId: string): Promise<OperationResult<CallerAccess | null>>;
}

export interface AdminClient {
  roleExists(roleId: string): Promise<OperationResult<boolean>>;
  inviteUser(
    email: string,
    name: string,
  ): Promise<OperationResult<InvitedUser>>;
  insertProfile(profile: NewProfile): Promise<OperationResult<void>>;
  deleteUser(userId: string): Promise<OperationResult<void>>;
}

export interface HandlerDependencies {
  createCallerClient(authorization: string): CallerClient;
  createAdminClient(): AdminClient;
  logError?: (operation: string, error?: OperationError) => void;
}

type InvitePayload = {
  email: string;
  name: string;
  roleId: string;
};

const corsHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invitationConflictCodes = new Set([
  "email_exists",
  "user_already_exists",
]);

function jsonResponse(status: number, body: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function operationError(error: unknown): OperationError {
  if (!error || typeof error !== "object") return {};
  const value = error as Record<string, unknown>;
  return {
    code: typeof value.code === "string" ? value.code : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    status: typeof value.status === "number" ? value.status : undefined,
  };
}

function requireEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function productionDependencies(): HandlerDependencies {
  const supabaseUrl = requireEnvironment("SUPABASE_URL");
  const anonKey = requireEnvironment("SUPABASE_ANON_KEY");
  const authOptions = {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  };

  return {
    createCallerClient(authorization) {
      const client = createClient(supabaseUrl, anonKey, {
        auth: authOptions,
        global: { headers: { Authorization: authorization } },
      });

      return {
        async getUser() {
          const { data, error } = await client.auth.getUser();
          if (error) return { data: null, error: operationError(error) };
          return { data: data.user ? { id: data.user.id } : null, error: null };
        },
        async getAccess(userId) {
          const { data, error } = await client
            .from("profiles")
            .select("active, roles!inner(manage_settings)")
            .eq("user_id", userId)
            .maybeSingle();
          if (error) return { data: null, error: operationError(error) };
          if (!data) return { data: null, error: null };

          const roles = data.roles as
            | { manage_settings?: boolean }
            | Array<{ manage_settings?: boolean }>
            | null;
          const role = Array.isArray(roles) ? roles[0] : roles;
          return {
            data: {
              active: data.active === true,
              manageSettings: role?.manage_settings === true,
            },
            error: null,
          };
        },
      };
    },
    createAdminClient() {
      // Read and use the service-role key only after caller authorization succeeds.
      const serviceRoleKey = requireEnvironment("SUPABASE_SERVICE_ROLE_KEY");
      const client = createClient(supabaseUrl, serviceRoleKey, {
        auth: authOptions,
      });

      return {
        async roleExists(roleId) {
          const { data, error } = await client
            .from("roles")
            .select("id")
            .eq("id", roleId)
            .maybeSingle();
          if (error) return { data: null, error: operationError(error) };
          return { data: data !== null, error: null };
        },
        async inviteUser(email, name) {
          const { data, error } = await client.auth.admin.inviteUserByEmail(
            email,
            {
              data: { name },
            },
          );
          if (error) return { data: null, error: operationError(error) };
          return { data: { id: data.user.id }, error: null };
        },
        async insertProfile(profile) {
          const { error } = await client.from("profiles").insert({
            name: profile.name,
            role_id: profile.roleId,
            user_id: profile.userId,
          });
          if (error) return { data: null, error: operationError(error) };
          return { data: undefined, error: null };
        },
        async deleteUser(userId) {
          const { error } = await client.auth.admin.deleteUser(userId);
          if (error) return { data: null, error: operationError(error) };
          return { data: undefined, error: null };
        },
      };
    },
    logError(operation, error) {
      console.error(JSON.stringify({
        operation,
        code: error?.code,
        status: error?.status,
      }));
    },
  };
}

async function parsePayload(request: Request): Promise<
  | { payload: InvitePayload; error: null }
  | { payload: null; error: string }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { payload: null, error: "Corpo JSON inválido." };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { payload: null, error: "Corpo JSON inválido." };
  }

  const raw = body as Record<string, unknown>;
  if (typeof raw.email !== "string") {
    return { payload: null, error: "Email inválido." };
  }
  if (typeof raw.name !== "string") {
    return { payload: null, error: "Nome inválido." };
  }
  if (typeof raw.roleId !== "string") {
    return { payload: null, error: "Papel inválido." };
  }

  const email = raw.email.trim().toLowerCase();
  const name = raw.name.trim();
  const roleId = raw.roleId.trim();
  if (email.length > 254 || !emailPattern.test(email)) {
    return { payload: null, error: "Email inválido." };
  }
  if (name.length === 0 || name.length > 120) {
    return { payload: null, error: "Nome inválido." };
  }
  if (!uuidPattern.test(roleId)) {
    return { payload: null, error: "Papel inválido." };
  }

  return { payload: { email, name, roleId }, error: null };
}

export function createInviteUserHandler(
  dependencies: HandlerDependencies,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido." }), {
        status: 405,
        headers: {
          ...corsHeaders,
          "allow": "POST, OPTIONS",
          "content-type": "application/json; charset=utf-8",
        },
      });
    }

    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      return jsonResponse(401, { error: "Autenticação necessária." });
    }

    try {
      const callerClient = dependencies.createCallerClient(authorization);
      const userResult = await callerClient.getUser();
      if (userResult.error || !userResult.data) {
        return jsonResponse(401, { error: "Autenticação necessária." });
      }

      const accessResult = await callerClient.getAccess(userResult.data.id);
      if (accessResult.error) {
        dependencies.logError?.("read_caller_access", accessResult.error);
        return jsonResponse(500, {
          error: "Não foi possível verificar sua permissão. Tente novamente.",
        });
      }
      if (
        !accessResult.data ||
        !accessResult.data.active ||
        !accessResult.data.manageSettings
      ) {
        return jsonResponse(403, {
          error: "Você não tem permissão para convidar usuárias.",
        });
      }

      const parsed = await parsePayload(request);
      if (parsed.payload === null) {
        return jsonResponse(400, { error: parsed.error });
      }

      const adminClient = dependencies.createAdminClient();
      const roleResult = await adminClient.roleExists(parsed.payload.roleId);
      if (roleResult.error) {
        dependencies.logError?.("read_role", roleResult.error);
        return jsonResponse(500, {
          error: "Não foi possível concluir o convite. Tente novamente.",
        });
      }
      if (!roleResult.data) {
        return jsonResponse(400, { error: "Papel inválido." });
      }

      const invitationResult = await adminClient.inviteUser(
        parsed.payload.email,
        parsed.payload.name,
      );
      if (invitationResult.error) {
        dependencies.logError?.("invite_auth_user", invitationResult.error);
        if (
          invitationResult.error.code &&
          invitationConflictCodes.has(invitationResult.error.code)
        ) {
          return jsonResponse(409, {
            error: "Não foi possível enviar o convite para este email.",
          });
        }
        return jsonResponse(500, {
          error: "Não foi possível concluir o convite. Tente novamente.",
        });
      }

      const profileResult = await adminClient.insertProfile({
        userId: invitationResult.data.id,
        name: parsed.payload.name,
        roleId: parsed.payload.roleId,
      });
      if (profileResult.error) {
        dependencies.logError?.("insert_profile", profileResult.error);
        const compensationResult = await adminClient.deleteUser(
          invitationResult.data.id,
        );
        if (compensationResult.error) {
          dependencies.logError?.(
            "compensate_auth_user",
            compensationResult.error,
          );
        }
        return jsonResponse(500, {
          error: "Não foi possível concluir o convite. Tente novamente.",
        });
      }

      return jsonResponse(200, { userId: invitationResult.data.id });
    } catch (error) {
      dependencies.logError?.(
        "unhandled_invitation_error",
        operationError(error),
      );
      return jsonResponse(500, {
        error: "Não foi possível concluir o convite. Tente novamente.",
      });
    }
  };
}

export async function handler(request: Request): Promise<Response> {
  return await createInviteUserHandler(productionDependencies())(request);
}

export default { fetch: handler };
