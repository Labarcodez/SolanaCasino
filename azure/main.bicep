@description('Azure region (eastus is usually cheapest for credits)')
param location string = resourceGroup().location

@description('Short name prefix for resources (lowercase, 3-12 chars)')
param namePrefix string = 'orbitcasino'

@description('App Service plan SKU — B1 is enough until you scale')
param appServicePlanSku string = 'B1'

@secure()
@description('JWT secret for production sessions')
param jwtSecret string

@secure()
param alchemyApiKey string = ''

@secure()
param casinoWalletPrivateKey string = ''

param casinoWalletAddress string = 'C9W7nGv2ZBJp4zcmtvBHkrtTPhB1FQ7JaNNPRNhiA4Ze'
param adminWallet string = ''
param solanaCluster string = 'mainnet-beta'
param programId string = 'Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU'
param brandName string = 'Orbit Solana Casino'

var uniqueSuffix = uniqueString(resourceGroup().id)
var storageName = take('${namePrefix}data${uniqueSuffix}', 24)
var acrName = take('${namePrefix}acr${uniqueSuffix}', 50)
var planName = '${namePrefix}-plan'
var webAppName = take('${namePrefix}-${uniqueSuffix}', 60)
var imageName = 'orbit-casino:latest'

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  sku: {
    name: appServicePlanSku
    tier: startsWith(appServicePlanSku, 'B') ? 'Basic' : 'Standard'
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storage
  name: 'default'
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileService
  name: 'casino-data'
  properties: {
    shareQuota: 5
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${imageName}'
      alwaysOn: true
      healthCheckPath: '/api/health'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '3001'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://${acr.properties.loginServer}'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: acr.listCredentials().username
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: acr.listCredentials().passwords[0].value
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'SERVE_FRONTEND'
          value: 'true'
        }
        {
          name: 'PORT'
          value: '3001'
        }
        {
          name: 'SQLITE_PATH'
          value: '/app/backend/data/casino.db'
        }
        {
          name: 'FRONTEND_URL'
          value: 'https://${webAppName}.azurewebsites.net'
        }
        {
          name: 'SOLANA_CLUSTER'
          value: solanaCluster
        }
        {
          name: 'SOLANA_RPC_FALLBACK'
          value: 'https://solana.drpc.org'
        }
        {
          name: 'PROGRAM_ID'
          value: programId
        }
        {
          name: 'VITE_PROGRAM_ID'
          value: programId
        }
        {
          name: 'CASINO_WALLET_ADDRESS'
          value: casinoWalletAddress
        }
        {
          name: 'VITE_CASINO_WALLET'
          value: casinoWalletAddress
        }
        {
          name: 'ADMIN_WALLET'
          value: adminWallet
        }
        {
          name: 'BRAND_NAME'
          value: brandName
        }
        {
          name: 'JWT_SECRET'
          value: jwtSecret
        }
        {
          name: 'ALCHEMY_API_KEY'
          value: alchemyApiKey
        }
        {
          name: 'CASINO_WALLET_PRIVATE_KEY'
          value: casinoWalletPrivateKey
        }
        {
          name: 'VITE_API_URL'
          value: ''
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
      ]
    }
  }
}

resource storageMount 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: webApp
  name: 'azureStorageAccounts'
  properties: {
    CasinoData: {
      type: 'AzureFiles'
      accountName: storage.name
      shareName: fileShare.name
      accessKey: storage.listKeys().keys[0].value
      mountPath: '/app/backend/data'
    }
  }
}

output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.name}.azurewebsites.net'
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output imageReference string = '${acr.properties.loginServer}/${imageName}'
output storageAccountName string = storage.name
