# Narration beats, in order. Each beat's audio plays while its actions run on screen.
# Indian English, friendly and clear. No client names or numbers in the narration.
BEATS = [
  ("intro", "Namaste, and welcome to the Shradha Realty C R M. In this video, we will walk you through the complete app, step by step. How to log in, how to capture and assign leads, how to plan site visits and tasks, how inventory and approvals work, and all the settings in detail. So, let us begin."),

  ("login", "To open the C R M, use the link that we have shared with you. You will see this login page. It says Login to Frappe, and that is the correct page. Enter your login I D, which is your official email address, then your password, and click on Login. On your very first login, kindly change your password. We will show you how, at the end of this video."),

  ("dash1", "After logging in, you land on the Dashboard. Right on top, you can see today's date, and a quick summary of your site visits today and any follow ups that are overdue."),
  ("dash2", "Below that are the key numbers at a glance: open leads, visits this week, bookings, overdue collections, and the conversion rate."),
  ("dash3", "The sales funnel shows how many leads are at each stage, from New, all the way to Booked. On the right, the Today panel shows the tasks due for you today, with a link to your full calendar. And further below, Project performance shows every project, with its units and sales."),
  ("menu", "On the left side is the main menu. Dashboard, My Day, Approvals, which only managers see, Leads, Site Visits, Documents, Inventory, Bookings, Payments, Partners, Campaigns, Reports, and Settings. Let us go through them one by one."),

  ("leads1", "Let us open Leads. Here you can see all your leads in one table. The name and phone number, the project they are interested in, the stage, a score, the source, the sales owner, and the last activity."),
  ("leads2", "At the top, you can search by name, phone number or project. A small tip here: simply press the slash key on your keyboard, and you jump straight to the search box."),
  ("leads3", "You can also filter by stage, using these chips. For example, only the leads who are at the site visit stage. The drop downs on the right filter by project, owner or source. And the Filters button adds quick filters, like hot leads, or leads that are not assigned yet."),
  ("leads4", "If you prefer a board view, click on Kanban. Each column is one stage, from New to Booked, so you get a clear picture of your active pipeline. Lost leads stay in the table view. Let us switch back to the table."),

  ("new1", "Now, let us add a new lead. Click on New Lead. The form opens blank every time. In the first step, enter the customer's full name and mobile number. Email is optional."),
  ("new2", "If this mobile number is already there in the C R M, you get a warning immediately, showing the existing lead. This way, the same customer does not get entered twice. Let us correct the number."),
  ("new3", "Next, select the source, that is, where this lead has come from. If the source is Reference, you get a Referred by field, where you can type or pick the person who referred this customer."),
  ("new4", "If you select Channel Partner, a search box appears right below. Just type a few letters of the broker's name, and pick the partner from the list. If the broker is new, you can add a new partner from here itself."),
  ("new5", "In step two, select the project, the configuration, like two B H K, and an approximate budget. You can type the budget in rupees, or simply as forty five lakh, or one point two crore. The C R M understands both. Add any notes from your first conversation."),
  ("new6", "In the last step, choose the starting stage and the priority, check the quick summary once, and click on Save lead. That's it, the lead is created. When a sales person adds a lead, it is assigned to them automatically. Otherwise, a manager assigns it, as we will see now."),

  ("drawer1", "Click on any lead to open its details. On top, you have the customer's name, phone number and lead I D. Just below are the quick actions. Log call and WhatsApp record a conversation in the timeline. Then Email, Schedule visit, and Edit details."),
  ("drawer2", "Below that, you can change the status of the lead. And a manager can assign the lead to any sales person, using Assign to. Let us assign this lead to Avinash."),
  ("drawer3", "Now let us log a call. Type a short note of what was discussed, and click on Log. The note gets added to the Activity timeline, with your name and the time. So the complete history of the customer stays in one place."),
  ("drawer4", "After the call, let us move the status to Contacted. And if anything needs to be corrected, like the phone number, email, budget, source or channel partner, click on Edit details, make the change, and save. Every change is recorded in the timeline."),
  ("visit", "To plan a site visit, click on Schedule visit. Pick the date and the time, the number of people coming, add a note if required, and click Schedule visit. The visit now shows on the sales person's calendar, and it is noted in the lead's timeline."),
  ("task1", "Next is the Tasks tab. Tasks are your follow ups, like a call back, sending the cost sheet, or collecting documents. Click on New task, write what has to be done, and choose the type."),
  ("task2", "Then assign it to the team member, and set the due date and time. Click on Create task. The task appears here, and also on that person's My Day calendar. Once the work is done, the assigned person, or a manager, ticks the box."),
  ("tabs", "The Unit interest tab shows the available units in the lead's project. And the Documents tab keeps the papers for this lead. You can upload them right here."),
  ("email1", "The Email button opens an A I email assistant. Choose the type of email, tell it in one line what you want to say, and click Draft with A I."),
  ("email2", "The A I then writes the subject and the body, using the lead's project and budget details, and you can edit it before sending. To send emails, each user first adds their own email account in Settings."),

  ("myday1", "Now let us open My Day. This is the calendar of tasks and site visits for the week. Under Calendar of, you can pick any team member, or select Everyone to see the whole team. Here you can see the visit and the task we just created for Avinash."),
  ("myday2", "You can filter by project, switch between week and day view, jump to any date, or come back to today. Click on a visit, or a task linked to a lead, to open that lead directly."),
  ("visits", "Site Visits uses the same calendar, but shows the visits of the whole team, like the one we just booked. In a week with no visits, a link takes you straight to the latest visit."),

  ("inv1", "Next is Inventory. Select a project at the top. You can see the project details, and below that, every unit, floor by floor, colour coded as available, blocked, reserved or sold."),
  ("inv2", "Click on any unit to see its carpet area, built up area, price and status. When a customer wants a unit to be kept for them, click Request hold, select the lead, or enter an outside enquiry, and submit. The request goes to a manager for approval, so that two people never commit the same flat."),

  ("docs1", "The Documents section is your library for brochures, floor plans, price lists and agreements, stored project wise. Click on Upload, choose the file, select the project and category, and mark it shareable if it can be given to customers."),
  ("docs2", "To send a document to a customer, a team member clicks Share with a lead and selects the lead. The request shows as pending, and goes to a manager. Only after the manager approves it, a secure link is created for the customer."),

  ("appr1", "All such requests come to the manager in Approvals. Unit holds and document shares, in one single inbox. Click on Approve, and the unit gets blocked or reserved for that customer, or the document link becomes active."),
  ("appr2", "In the Active section below, the manager can release a hold, copy a document link, or revoke it whenever required."),

  ("empty", "Bookings, Payments and Campaigns will hold your booking cost sheets, payment schedules and marketing campaigns. Creating these is the next part we are building with your team, so for now, they are empty."),
  ("partners", "In Partners, you have the full list of channel partners. Search by name, contact person or phone number, filter by tier, and click View leads, to see all the leads that a partner has given. New brokers can be added using Onboard partner."),
  ("reports", "Reports gives you the overall picture. Bookings, units sold, lead to booking conversion, the trend of site visits over the last six months, lead sources, and sales by project. You can download all these figures using Export C S V."),

  ("set1", "Now, let us go through the Settings in detail. Workspace shows the regional defaults, that is, the currency in rupees, and the time zone in Indian Standard Time."),
  ("set2", "Team and roles lists all your sales team members, their logins, and the site each person mainly works on. For example, here is our new team member, Avinash Soyam, for the Isasani site, that is, Abhiman Niwas. A manager can change the site from here itself."),
  ("set3", "To add a new member, a manager clicks on Add member, and enters the name, role, phone number, site and email. An admin can also tick the box to create a login, and then set its password in Users and access."),
  ("set4", "Users and access is where an admin manages all the C R M logins. Click Add login to create a login. Enter the person's name and email, and choose the access level. The C R M fills in a strong temporary password. When you click Create login, the login I D and password are shown once, with Copy buttons, so that you can share them privately."),
  ("set5", "There are four access levels. Sales Executive works on leads, visits, tasks and inventory. Sales Manager can also assign leads and approve requests. Finance is meant for payments, and can also see the leads. And Admin can do everything, including managing logins. From this list, you can reset a password, change someone's role, or disable a login when a person leaves. Disabling logs them out immediately."),
  ("set6", "Projects lists all the projects in the C R M. Lead stages shows the pipeline every lead moves through, from New to Booked or Lost. And in Sources, a manager can add a new lead source, for example a new property portal, or remove one that is not being used."),
  ("set7", "In Email, each user adds the email address they send customer emails from. For Gmail, you need an App Password, which you can create in your Google account, under Security. Templates and Integrations, like WhatsApp and the property portals, are planned for the coming phases."),
  ("pwd", "Finally, to change your password, click on Change password, at the bottom left, under your name. Enter your current password, then the new password twice, and save. We recommend that every user does this on their first login."),
  ("outro", "That's all for this walkthrough. Kindly start using the C R M every day, so that every lead, every visit and every follow up is in one place. If you have any questions or need any help, please feel free to reach out to the DUX Digitech team. Thank you!"),
]
