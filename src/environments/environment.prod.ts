export const environment = {
    production: true,
    keycloak: {
        url: 'http://localhost:8083',
        realm: 'erpai-realm',
        clientId: 'erpai2.0-client'
    },
    apiUrl: '/api',
    responseKey: 'cf04c01dc4d6b103528c45f8b9e8b333d9f45bd1cbdff0c8d112bf080b7d1359' // must match server RESPONSE_ENCRYPTION_KEY
};
