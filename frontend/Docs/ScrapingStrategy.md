### Scrapping Strategy 

1. Utlizing the LLM key provided by the user in onboarding step, initialize a Claude Web instance and visit the sites inputed by the users while using the respected browser profiels to enable utilization of the cookie sessions. 

2. Once visited the site, use the Claude Web instace to get a constext node which will enable us to see the data. TODO: Validate: NODE Structure, How deep it goes, If data is good enough. ❗️CRITICAL❗️

3. Contextualize the data via LLM, creating prioratization, classification and action items. See more on this. [/Connection-Point/frontend/src/main/agents/github-classifier.js]



MVP 1 will include Github, Jira and Calander Integrations only. No Details view of each item (drawer), instead the drawer should contain same info with a link to redirect to URL. 


### Individual Scrapping Strategy:
1. Github:
    1. /Issues: From issues page we should be able to determine the following: `Repo, Title, Status, Author, Labels, Amount of Comments`;
    2. /PR: From pr page we should be able to determine the following: `Repo, Title, Status, Author, Labels, Amount of Comments`;
    3. 


