import {
  type AdminClient,
  type CallerClient,
  createInviteUserHandler,
  type HandlerDependencies,
  type OperationResult,
} from "./index.ts";

function assertEquals(
  actual: unknown,
  expected: unknown,
  message?: string,
): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(
      message ?? `Expected ${expectedJson}, received ${actualJson}`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const validBody = {
  email: "nova@example.com",
  name: "Nova Usuária",
  roleId: "d9428888-122b-4f9f-9730-0f8f709a9c2e",
};

function request(
  body: unknown = validBody,
  options: {
    method?: string;
    authorization?: string | null;
    rawBody?: string;
  } = {},
): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.authorization !== null) {
    headers.set("authorization", options.authorization ?? "Bearer valid-token");
  }
  return new Request("http://localhost/functions/v1/invite-user", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET"
      ? undefined
      : (options.rawBody ?? JSON.stringify(body)),
  });
}

type Overrides = {
  getUser?: CallerClient["getUser"];
  getAccess?: CallerClient["getAccess"];
  roleExists?: AdminClient["roleExists"];
  inviteUser?: AdminClient["inviteUser"];
  insertProfile?: AdminClient["insertProfile"];
  deleteUser?: AdminClient["deleteUser"];
};

function ok<T>(data: T): OperationResult<T> {
  return { data, error: null };
}

function testDependencies(overrides: Overrides = {}) {
  const calls: string[] = [];
  let adminClientCreations = 0;

  const callerClient: CallerClient = {
    getUser: overrides.getUser ??
      (() => Promise.resolve(ok({ id: "caller-id" }))),
    getAccess: overrides.getAccess ??
      (() => Promise.resolve(ok({ active: true, manageSettings: true }))),
  };
  const adminClient: AdminClient = {
    roleExists: overrides.roleExists ?? (() => Promise.resolve(ok(true))),
    inviteUser: overrides.inviteUser ??
      (() => Promise.resolve(ok({ id: "invited-user-id" }))),
    insertProfile: overrides.insertProfile ??
      (() => Promise.resolve(ok(undefined))),
    deleteUser: overrides.deleteUser ?? (() => Promise.resolve(ok(undefined))),
  };

  const dependencies: HandlerDependencies = {
    createCallerClient: () => {
      calls.push("create-caller-client");
      return {
        getUser: async () => {
          calls.push("get-user");
          return await callerClient.getUser();
        },
        getAccess: async (userId) => {
          calls.push(`get-access:${userId}`);
          return await callerClient.getAccess(userId);
        },
      };
    },
    createAdminClient: () => {
      calls.push("create-admin-client");
      adminClientCreations += 1;
      return {
        roleExists: async (roleId) => {
          calls.push(`role-exists:${roleId}`);
          return await adminClient.roleExists(roleId);
        },
        inviteUser: async (email, name) => {
          calls.push(`invite-user:${email}:${name}`);
          return await adminClient.inviteUser(email, name);
        },
        insertProfile: async (profile) => {
          calls.push(
            `insert-profile:${profile.userId}:${profile.name}:${profile.roleId}`,
          );
          return await adminClient.insertProfile(profile);
        },
        deleteUser: async (userId) => {
          calls.push(`delete-user:${userId}`);
          return await adminClient.deleteUser(userId);
        },
      };
    },
  };

  return {
    dependencies,
    calls,
    get adminClientCreations() {
      return adminClientCreations;
    },
  };
}

async function json(response: Response): Promise<unknown> {
  return await response.json();
}

Deno.test("rejects a caller without manage_settings before creating an admin client", async () => {
  const fixture = testDependencies({
    getAccess: () =>
      Promise.resolve(ok({ active: true, manageSettings: false })),
  });
  const handler = createInviteUserHandler(fixture.dependencies);

  const response = await handler(request());

  assertEquals(response.status, 403);
  assertEquals(await json(response), {
    error: "Você não tem permissão para convidar usuárias.",
  });
  assertEquals(fixture.adminClientCreations, 0);
});

Deno.test("rejects an inactive or missing caller profile before creating an admin client", async () => {
  for (
    const access of [
      { active: false, manageSettings: true },
      null,
    ]
  ) {
    const fixture = testDependencies({
      getAccess: () => Promise.resolve(ok(access)),
    });
    const response = await createInviteUserHandler(fixture.dependencies)(
      request(),
    );

    assertEquals(response.status, 403);
    assertEquals(fixture.adminClientCreations, 0);
  }
});

Deno.test("rejects missing and invalid bearer authorization", async () => {
  for (const authorization of [null, "Basic abc", "Bearer "]) {
    const fixture = testDependencies();
    const response = await createInviteUserHandler(fixture.dependencies)(
      request(validBody, { authorization }),
    );

    assertEquals(response.status, 401);
    assertEquals(await json(response), { error: "Autenticação necessária." });
    assertEquals(fixture.calls, []);
  }
});

Deno.test("rejects a JWT that does not resolve to a user", async () => {
  const fixture = testDependencies({
    getUser: () =>
      Promise.resolve({
        data: null,
        error: { code: "bad_jwt", message: "internal detail" },
      }),
  });

  const response = await createInviteUserHandler(fixture.dependencies)(
    request(),
  );

  assertEquals(response.status, 401);
  assertEquals(await json(response), { error: "Autenticação necessária." });
  assertEquals(fixture.adminClientCreations, 0);
});

Deno.test("validates JSON and invitation fields after authorization", async () => {
  const invalidCases: Array<[Request, string]> = [
    [request(undefined, { rawBody: "{" }), "Corpo JSON inválido."],
    [request({ ...validBody, email: "invalid" }), "Email inválido."],
    [request({ ...validBody, name: "   " }), "Nome inválido."],
    [request({ ...validBody, roleId: "not-a-uuid" }), "Papel inválido."],
  ];

  for (const [invalidRequest, error] of invalidCases) {
    const fixture = testDependencies();
    const response = await createInviteUserHandler(fixture.dependencies)(
      invalidRequest,
    );

    assertEquals(response.status, 400);
    assertEquals(await json(response), { error });
    assertEquals(fixture.adminClientCreations, 0);
  }
});

Deno.test("rejects an unknown role before sending an invitation", async () => {
  const fixture = testDependencies({
    roleExists: () => Promise.resolve(ok(false)),
  });
  const response = await createInviteUserHandler(fixture.dependencies)(
    request(),
  );

  assertEquals(response.status, 400);
  assertEquals(await json(response), { error: "Papel inválido." });
  assert(
    !fixture.calls.some((call) => call.startsWith("invite-user:")),
    "invitation must not be sent",
  );
});

Deno.test("invites the normalized email and creates the requested profile", async () => {
  const fixture = testDependencies();
  const response = await createInviteUserHandler(fixture.dependencies)(request({
    ...validBody,
    email: "  NOVA@Example.COM ",
    name: "  Nova Usuária  ",
  }));

  assertEquals(response.status, 200);
  assertEquals(await json(response), { userId: "invited-user-id" });
  assertEquals(fixture.calls, [
    "create-caller-client",
    "get-user",
    "get-access:caller-id",
    "create-admin-client",
    `role-exists:${validBody.roleId}`,
    "invite-user:nova@example.com:Nova Usuária",
    `insert-profile:invited-user-id:Nova Usuária:${validBody.roleId}`,
  ]);
});

Deno.test("returns a safe conflict when the email already belongs to an auth user", async () => {
  const fixture = testDependencies({
    inviteUser: () =>
      Promise.resolve({
        data: null,
        error: { code: "email_exists", message: "sensitive provider detail" },
      }),
  });
  const response = await createInviteUserHandler(fixture.dependencies)(
    request(),
  );

  assertEquals(response.status, 409);
  assertEquals(await json(response), {
    error: "Não foi possível enviar o convite para este email.",
  });
  assert(
    !fixture.calls.some((call) => call.startsWith("insert-profile:")),
    "profile must not be inserted",
  );
});

Deno.test("deletes a newly invited auth user when profile insertion fails", async () => {
  const fixture = testDependencies({
    insertProfile: () =>
      Promise.resolve({
        data: null,
        error: { code: "23503", message: "database detail" },
      }),
  });
  const response = await createInviteUserHandler(fixture.dependencies)(
    request(),
  );

  assertEquals(response.status, 500);
  assertEquals(await json(response), {
    error: "Não foi possível concluir o convite. Tente novamente.",
  });
  assert(
    fixture.calls.includes("delete-user:invited-user-id"),
    "new auth user must be compensated",
  );
});

Deno.test("uses safe errors when dependency operations fail", async () => {
  const cases: Overrides[] = [
    {
      getAccess: () =>
        Promise.resolve({
          data: null,
          error: { message: "profile query detail" },
        }),
    },
    {
      roleExists: () =>
        Promise.resolve({
          data: null,
          error: { message: "role query detail" },
        }),
    },
    {
      inviteUser: () =>
        Promise.resolve({
          data: null,
          error: { code: "provider_failure", message: "auth detail" },
        }),
    },
  ];

  for (const overrides of cases) {
    const response = await createInviteUserHandler(
      testDependencies(overrides).dependencies,
    )(request());
    const payload = await json(response) as { error: string };
    assertEquals(response.status, 500);
    assert(
      !payload.error.includes("detail"),
      "internal dependency details must not leak",
    );
  }
});

Deno.test("handles CORS preflight without creating clients", async () => {
  const fixture = testDependencies();
  const response = await createInviteUserHandler(fixture.dependencies)(
    request(undefined, { method: "OPTIONS", authorization: null }),
  );

  assertEquals(response.status, 204);
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assertEquals(
    response.headers.get("access-control-allow-methods"),
    "POST, OPTIONS",
  );
  assertEquals(fixture.calls, []);
});

Deno.test("rejects unsupported methods with CORS headers", async () => {
  const fixture = testDependencies();
  const response = await createInviteUserHandler(fixture.dependencies)(
    request(undefined, { method: "GET", authorization: null }),
  );

  assertEquals(response.status, 405);
  assertEquals(response.headers.get("allow"), "POST, OPTIONS");
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assertEquals(fixture.calls, []);
});
