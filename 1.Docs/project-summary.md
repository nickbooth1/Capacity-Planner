Work Scheduling

I want a simple system, where asset owners can login and see all of the planned works on their assets. They can have stakeholders who wish to perform works on the assets raise requests on the system, so they can review and approve / reject / ask for more information and then share with the wider organisation to ensure there is awareness of the works. The tool should also attempt to help out by providing an indicator on the impacts on the overall asset category capacity as a result of the works and provide insights regarding what impacts the works may have on other areas. So they can also impact assess and prepare for the works.

This empowers the asset owner to have control over works on their assets, supports stakeholder management and looks to allow them to make informed decisions regarding any works.

I want to start by creating a system that allows stand managers, to control the changes to their stands. Have a clear view of the ongoing works and an avenue to point people too - if they want to raise a request for any work.

The solution should have visual representation of the stands - outlining their physical locations, indicators on their status. Then an outline of their capabilities - that can be stored in an asset repository. Where stand information can be stored.

This is the MVP for the tool.

It will grow dramatically and the enablement in there to do so. But we want to start with stands, then add other asset categories from the rest of the airport in the following order:

- Stands
- Airfield
- Gates
- Check-in
- Baggage
- Security 
- Parking

We can then add functionality to the tool that will offer wider capabilities to customers.

Fundamentally, the tool initially will store asset information. Which maintenance requests can then be requested against, based upon the asset information loaded - an assessment tool will identify the capacity of the assets. That will then allow the impact assessments to be made for any requests for maintenance on an asset - to allow key stakeholders to make informed decisions.

The MVP of the tool, will not have the capacity calculator - it will purely just list the assets, then have a tracker for maintenance requests.

The first function that the MVP will cover will be Stands, so we will focus on ensuring that we have all of the required data for stand information in a data schema. Then we are ready to upload information.

Then building a request tracker interface that we can replicate across other functions of the airport - when we get to the point of expanding to other functions will be the intention.

That will be the MVP, then we can expand to the airfield and gates.

Once these these assets are set up for tracking - we can then start to build out the capacity calculator. Starting with stands - identifying the key metrics which need tracking. Get an engine working to calculate via the inputs from the stands - then provide an output - create the output displays to support and integrate these outputs into the requests - so that the requests when raised - are able to show reviews the impact. Will also need to create adjustments to the illustrations which can show the impact the works will have on capacity.

User Stories
As an asset owner, I want to be able to see all of the changes which are currently in progress on my assets. Know when any works will complete and understand the impact the works are having on the capacity and capability of my asset.

As an airport planner, I need to be able to understand the capacity thats available. To be able to plan out the airports capacity and utilisation.

As a project manager, I need to be able to perform upgrades to an asset to deliver my project. I require approval from operations on when to do this and manage my stakeholders and delivery plan.

Key Persona’s

CapaCity Planner Accounts
Admin-Support - Able to control all information, including the base airport

Client Accounts
Admin - Able to manage accounts
Asset Owner - able to edit asset data and approve/reject requests
Airport Planner - Able to control asset information, requests info - unable to reject / approve requests
Key Stakeholder - Ability to view, not review requests - but able to see all of the outputs
3rd Party Contractor - wants to raise requests to perform works on an asset - but is only able to see the requests that they raise and edit that data - will also have their own access page for 3rd parties
Requester - wants to raise requests to perform works on an asset - could be internal project manager, so would be accessing internally (question on whether these are just the same? They access via the web on a link? Nothing different - but have strict controls)

Selling Approach
Clients will need to contact us for pricing, where an invoice can then be issued to them to pay for what they would like. Once paid, the account can then be created for the airport and an onboarding process kicked off. They will be able to add different modules, by paying additional for them - again, an invoice will be issued upon request - then the module added once payment received. So no payment mechanism is needed on the site.

Architecture
I want each of the modules to be independent - to support the set up of users being to add modules if they want to. Plus them being able to operate individually. There will be a base offering of assets and work scheduling - that is then built upon by capacity in the MVP and added to the base offering. Then further modules will be extra, planning, monitoring, analysis and scenario’s. 

Each client, will have their own environment - so they are completely self contained - so we will need to ensure we have the scaling approach and architecture to support that.

I want a local staging environment thats based within docker - running locally.

Then production running on Vercel for Frontend, Backend on Railway and DB on Supabase.

Frontend will be in Next.js, backend in Node.js & DB in PostgreSQL.


