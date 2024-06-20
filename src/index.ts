import * as express from 'express';
import {auth, requiresAuth} from 'express-openid-connect';
import * as cors from 'cors';

const env = require(process.cwd() + '/env.json');

const app = express();
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: env.secret,
  baseURL: env.baseURL,
  clientID: env.clientID,
  issuerBaseURL: env.issuerBaseURL,
};

app.use(
  cors({
    origin: env.frontendURL,
    credentials: true,
  })
);

app.use(auth({...config, routes: {login: false, logout: false}}));

app.get('/login', (req, res) => {
  res.oidc.login({returnTo: env.frontendURL + '?loggedIn=true'});
});

app.get('/logout', (req, res) => {
  res.oidc.logout({returnTo: env.frontendURL});
});

app.get('/authenticated', (req, res) => {
  res.send({loggedIn: req.oidc.isAuthenticated()});
});

app.get('/profile', requiresAuth(), (req, res) => {
  res.send({
    email: req.oidc.user!.email,
    name: req.oidc.user!.name,
  });
});

app.listen(8000, '0.0.0.0');
