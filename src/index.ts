import * as express from 'express';
import {auth, requiresAuth} from 'express-openid-connect';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import {ManagementClient} from 'auth0';

const env = require(process.cwd() + '/env.json');

const auth0Management = new ManagementClient({
  domain: new URL(env.issuerBaseURL).hostname,
  clientId: env.clientID,
  clientSecret: env.clientSecret,
});

const app = express();
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: env.secret,
  baseURL: env.baseURL,
  clientID: env.clientID,
  issuerBaseURL: env.issuerBaseURL,
};

app.use(bodyParser.json());

app.use(
  cors({
    origin: env.frontendURL,
    credentials: true,
  })
);

app.use(
  auth({
    ...config,
    routes: {login: false, logout: false},
  })
);

app.get('/login', (req, res) => {
  res.oidc.login({
    returnTo: env.frontendURL + '?loggedIn=true',
  });
});

app.get('/logout', requiresAuth(), (req, res) => {
  res.oidc.logout({returnTo: env.frontendURL});
});

app.get('/profile', requiresAuth(), async (req, res) => {
  // Retrieve user profile from the API instead of relying on the
  // OIDC object since that information doesn't get updated in real-time (requires reauthentication)
  const response = await auth0Management.users.get({id: req.oidc.user!.sub});
  const user = {
    name: response.data.name,
    email: response.data.email,
  };

  res.send(user);
});

app.patch('/profile', requiresAuth(), async (req, res) => {
  const {name} = req.body;

  if (!name) {
    res.status(400).send({error: 'Name is required'});
    return;
  }

  try {
    await auth0Management.users.update({id: req.oidc.user!.sub}, {name});
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).send({error: 'Failed to update profile'});
  }
});

app.get('/users', requiresAuth(), async (req, res) => {
  try {
    const users = [];
    let page = 0;

    while (true) {
      const response = await auth0Management.users.getAll({
        fields: 'email,created_at,logins_count,last_login',
        include_totals: true,
        page,
      });

      for (const user of response.data.users) {
        users.push(user);
      }

      if (users.length === response.data.total) {
        break;
      }

      page++;
    }

    res.send(
      users.map((user: any) => ({
        email: user.email,
        createdAt: user.created_at,
        loginCount: user.logins_count,
        lastSession: user.last_login,
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).send({error: 'Failed to retrieve users'});
  }
});

app.get('/stats', requiresAuth(), async (req, res) => {
  const response = await auth0Management.users.getAll({
    include_totals: true,
    per_page: 0,
  });

  res.send({
    totalUsers: response.data.total,
  });
});

app.listen(8000, '0.0.0.0');
