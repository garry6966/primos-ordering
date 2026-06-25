# Project TODO

## New Features (Reviews, Loyalty, Accounts)

- [ ] Database: Add reviews table (id, customerName, customerEmail, orderId, orderNumber, rating, comment, status, createdAt)
- [ ] Database: Add loyalty_accounts table (id, email UNIQUE, stamps, totalStampsEarned, createdAt, updatedAt)
- [ ] Database: Add reviewEmailSent and loyaltyStampsAwarded columns to orders table
- [ ] Backend: reviews.list (public, approved only)
- [ ] Backend: reviews.submit (public, creates pending review)
- [ ] Backend: reviews.listPending (kitchen-auth-protected)
- [ ] Backend: reviews.moderate (kitchen-auth-protected, approve/reject)
- [ ] Backend: loyalty.getStamps (public, input: email)
- [ ] Backend: orders.create extended with loyalty stamp award (>=£30) and redemption
- [ ] Backend: orders.updateStatus extended with 2-hour delayed review email
- [ ] Backend: account.getOrders (public, input: email)
- [ ] Email: sendReviewRequestEmail function (2 hours after completion)
- [ ] Frontend: /reviews page (submission form with star rating)
- [ ] Frontend: /loyalty page (check stamps by email)
- [ ] Frontend: /account page (order history + stamps by email)
- [ ] Frontend: Home.tsx reviews section (between deal banner and hours)
- [ ] Frontend: Kitchen.tsx reviews moderation tab
- [ ] Frontend: Checkout.tsx loyalty integration (check/redeem stamps)
- [ ] Frontend: Confirmation.tsx show stamps earned
- [ ] Frontend: Header.tsx add Loyalty/Account nav links
- [ ] Frontend: App.tsx register new routes
- [ ] Push to GitHub and verify deployment
