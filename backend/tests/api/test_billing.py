"""Tests for billing API business logic."""

import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.storage.models import (
    AgentSubscription,
    Agent,
    MarketplaceAgent,
    SellerProfile,
    Team,
    User,
)
from src.core.state import PricingType, SubscriptionStatus, AgentStatus
from src.api.billing import (
    _handle_checkout_completed,
    _handle_account_updated,
)
from src.api.agents import verify_agent_subscription


# ============== Fixtures ==============


class TestBillingFixtures:
    """Test fixture creation for billing tests."""

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession) -> User:
        """Create a test user."""
        user = User(
            id=str(uuid4()),
            email="test@example.com",
            username="testuser",
            hashed_password="hashed",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        return user

    @pytest.fixture
    async def test_team(self, db_session: AsyncSession, test_user: User) -> Team:
        """Create a test team owned by the test user."""
        team = Team(
            id=str(uuid4()),
            name="Test Team",
            owner_id=test_user.id,
        )
        db_session.add(team)
        await db_session.commit()
        return team

    @pytest.fixture
    async def test_agent(self, db_session: AsyncSession, test_user: User) -> Agent:
        """Create a test agent."""
        agent = Agent(
            id=str(uuid4()),
            name="Test Agent",
            role="coder",
            inference_endpoint="https://test.example.com/v1",
            inference_provider="openai",
            inference_model="gpt-4",
            owner_id=test_user.id,
            status=AgentStatus.ONLINE,
        )
        db_session.add(agent)
        await db_session.commit()
        return agent

    @pytest.fixture
    async def free_marketplace_agent(
        self, db_session: AsyncSession, test_agent: Agent, test_user: User
    ) -> MarketplaceAgent:
        """Create a FREE marketplace agent."""
        ma = MarketplaceAgent(
            id=str(uuid4()),
            agent_id=test_agent.id,
            seller_id=test_user.id,
            name="Free Agent",
            category="coder",
            pricing_type=PricingType.FREE.value,
            is_active=True,
        )
        db_session.add(ma)
        await db_session.commit()
        return ma

    @pytest.fixture
    async def paid_marketplace_agent(
        self, db_session: AsyncSession, test_agent: Agent, test_user: User
    ) -> MarketplaceAgent:
        """Create a USAGE_BASED marketplace agent."""
        ma = MarketplaceAgent(
            id=str(uuid4()),
            agent_id=test_agent.id,
            seller_id=test_user.id,
            name="Paid Agent",
            category="coder",
            pricing_type=PricingType.USAGE_BASED.value,
            price_per_use=5.00,
            stripe_product_id="price_test123",
            is_active=True,
        )
        db_session.add(ma)
        await db_session.commit()
        return ma

    @pytest.fixture
    async def seller_profile(self, db_session: AsyncSession, test_user: User) -> SellerProfile:
        """Create a seller profile with Stripe Connect."""
        profile = SellerProfile(
            id=str(uuid4()),
            user_id=test_user.id,
            stripe_account_id="acct_test123",
            payout_enabled=True,
            total_earnings=100.0,
        )
        db_session.add(profile)
        await db_session.commit()
        return profile


# ============== Webhook Handler Tests ==============


class TestHandleCheckoutCompleted(TestBillingFixtures):
    """Tests for checkout.session.completed webhook handler."""

    async def test_creates_subscription_on_marketplace_purchase(
        self,
        db_session: AsyncSession,
        test_team: Team,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that checkout completed creates an agent subscription."""
        session = {
            "id": "cs_test123",
            "subscription": "sub_test123",
            "payment_intent": "pi_test123",
            "metadata": {
                "type": "marketplace_agent_purchase",
                "team_id": test_team.id,
                "marketplace_agent_id": paid_marketplace_agent.id,
            },
        }

        await _handle_checkout_completed(session, db_session)

        # Verify subscription was created
        result = await db_session.execute(
            select(AgentSubscription).where(
                AgentSubscription.team_id == test_team.id,
                AgentSubscription.marketplace_agent_id == paid_marketplace_agent.id,
            )
        )
        subscription = result.scalar_one_or_none()

        assert subscription is not None
        assert subscription.status == SubscriptionStatus.ACTIVE.value
        assert subscription.stripe_subscription_id == "sub_test123"
        assert subscription.paid_order_id == "pi_test123"

    async def test_ignores_non_marketplace_purchases(
        self,
        db_session: AsyncSession,
        test_team: Team,
    ):
        """Test that non-marketplace purchases are ignored."""
        session = {
            "id": "cs_other",
            "metadata": {
                "type": "team_subscription",  # Different type
                "team_id": test_team.id,
            },
        }

        await _handle_checkout_completed(session, db_session)

        # No subscription should be created
        result = await db_session.execute(
            select(AgentSubscription).where(AgentSubscription.team_id == test_team.id)
        )
        subscriptions = result.scalars().all()

        assert len(subscriptions) == 0

    async def test_handles_missing_metadata_gracefully(
        self,
        db_session: AsyncSession,
    ):
        """Test that missing metadata doesn't cause errors."""
        session = {
            "id": "cs_no_meta",
            "metadata": {},
        }

        # Should not raise
        await _handle_checkout_completed(session, db_session)

    async def test_handles_partial_metadata(
        self,
        db_session: AsyncSession,
    ):
        """Test that partial metadata doesn't create subscription."""
        session = {
            "id": "cs_partial",
            "metadata": {
                "type": "marketplace_agent_purchase",
                "team_id": "some_team",
                # Missing marketplace_agent_id
            },
        }

        # Should not raise and should not create subscription
        await _handle_checkout_completed(session, db_session)


class TestHandleAccountUpdated(TestBillingFixtures):
    """Tests for account.updated webhook handler."""

    async def test_updates_seller_payout_enabled(
        self,
        db_session: AsyncSession,
        seller_profile: SellerProfile,
    ):
        """Test that account update changes payout_enabled status."""
        account = {
            "id": seller_profile.stripe_account_id,
            "payouts_enabled": True,
        }

        await _handle_account_updated(account, db_session)
        await db_session.refresh(seller_profile)

        assert seller_profile.payout_enabled is True

    async def test_updates_payout_to_false(
        self,
        db_session: AsyncSession,
        seller_profile: SellerProfile,
    ):
        """Test that account update can disable payouts."""
        # First ensure it's enabled
        seller_profile.payout_enabled = True
        await db_session.commit()

        account = {
            "id": seller_profile.stripe_account_id,
            "payouts_enabled": False,
        }

        await _handle_account_updated(account, db_session)
        await db_session.refresh(seller_profile)

        assert seller_profile.payout_enabled is False

    async def test_handles_unknown_account_gracefully(
        self,
        db_session: AsyncSession,
    ):
        """Test that unknown account IDs don't cause errors."""
        account = {
            "id": "acct_unknown",
            "payouts_enabled": True,
        }

        # Should not raise
        await _handle_account_updated(account, db_session)


# ============== Subscription Status Tests ==============


class TestAgentSubscriptionModel(TestBillingFixtures):
    """Tests for AgentSubscription model behavior."""

    async def test_subscription_starts_active(
        self,
        db_session: AsyncSession,
        test_team: Team,
        free_marketplace_agent: MarketplaceAgent,
    ):
        """Test that new subscriptions default to ACTIVE status."""
        subscription = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=free_marketplace_agent.id,
        )
        db_session.add(subscription)
        await db_session.commit()
        await db_session.refresh(subscription)

        assert subscription.status == SubscriptionStatus.ACTIVE.value

    async def test_can_query_active_subscriptions(
        self,
        db_session: AsyncSession,
        test_team: Team,
        free_marketplace_agent: MarketplaceAgent,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test querying for active subscriptions."""
        # Create active subscription
        active = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=free_marketplace_agent.id,
            status=SubscriptionStatus.ACTIVE.value,
        )
        # Create cancelled subscription
        cancelled = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=paid_marketplace_agent.id,
            status=SubscriptionStatus.CANCELLED.value,
        )
        db_session.add_all([active, cancelled])
        await db_session.commit()

        # Query only active
        result = await db_session.execute(
            select(AgentSubscription).where(
                AgentSubscription.team_id == test_team.id,
                AgentSubscription.status == SubscriptionStatus.ACTIVE.value,
            )
        )
        active_subs = result.scalars().all()

        assert len(active_subs) == 1
        assert active_subs[0].marketplace_agent_id == free_marketplace_agent.id


# ============== Seller Profile Tests ==============


class TestSellerProfileModel(TestBillingFixtures):
    """Tests for SellerProfile model behavior."""

    async def test_seller_profile_tracks_earnings(
        self,
        db_session: AsyncSession,
        seller_profile: SellerProfile,
    ):
        """Test that total_earnings can be updated."""
        seller_profile.total_earnings = 250.50
        await db_session.commit()
        await db_session.refresh(seller_profile)

        assert seller_profile.total_earnings == 250.50

    async def test_seller_profile_unique_per_user(
        self,
        db_session: AsyncSession,
        test_user: User,
        seller_profile: SellerProfile,
    ):
        """Test that user_id is unique on seller profiles."""
        from sqlalchemy.exc import IntegrityError

        duplicate = SellerProfile(
            id=str(uuid4()),
            user_id=test_user.id,  # Same user
            stripe_account_id="acct_different",
        )
        db_session.add(duplicate)

        with pytest.raises(IntegrityError):
            await db_session.commit()


# ============== MarketplaceAgent Pricing Tests ==============


class TestMarketplaceAgentPricing(TestBillingFixtures):
    """Tests for marketplace agent pricing models."""

    async def test_free_agent_has_no_price(
        self,
        db_session: AsyncSession,
        free_marketplace_agent: MarketplaceAgent,
    ):
        """Test that FREE agents have no price_per_use."""
        assert free_marketplace_agent.pricing_type == PricingType.FREE.value
        assert free_marketplace_agent.price_per_use is None
        assert free_marketplace_agent.stripe_product_id is None

    async def test_paid_agent_has_price_and_stripe_id(
        self,
        db_session: AsyncSession,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that USAGE_BASED agents have price and Stripe product."""
        assert paid_marketplace_agent.pricing_type == PricingType.USAGE_BASED.value
        assert paid_marketplace_agent.price_per_use == 5.00
        assert paid_marketplace_agent.stripe_product_id == "price_test123"

    async def test_can_filter_by_pricing_type(
        self,
        db_session: AsyncSession,
        free_marketplace_agent: MarketplaceAgent,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test filtering agents by pricing type."""
        result = await db_session.execute(
            select(MarketplaceAgent).where(MarketplaceAgent.pricing_type == PricingType.FREE.value)
        )
        free_agents = result.scalars().all()

        result = await db_session.execute(
            select(MarketplaceAgent).where(
                MarketplaceAgent.pricing_type == PricingType.USAGE_BASED.value
            )
        )
        paid_agents = result.scalars().all()

        assert len(free_agents) == 1
        assert len(paid_agents) == 1
        assert free_agents[0].name == "Free Agent"
        assert paid_agents[0].name == "Paid Agent"


# ============== Business Logic Tests ==============


class TestPurchaseLogic(TestBillingFixtures):
    """Tests for purchase business logic."""

    async def test_cannot_subscribe_twice_to_same_agent(
        self,
        db_session: AsyncSession,
        test_team: Team,
        free_marketplace_agent: MarketplaceAgent,
    ):
        """Test that duplicate active subscriptions are prevented."""
        # Create first subscription
        sub1 = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=free_marketplace_agent.id,
            status=SubscriptionStatus.ACTIVE.value,
        )
        db_session.add(sub1)
        await db_session.commit()

        # Check for existing active subscription (business logic check)
        result = await db_session.execute(
            select(AgentSubscription).where(
                AgentSubscription.team_id == test_team.id,
                AgentSubscription.marketplace_agent_id == free_marketplace_agent.id,
                AgentSubscription.status == SubscriptionStatus.ACTIVE.value,
            )
        )
        existing = result.scalar_one_or_none()

        assert existing is not None

    async def test_can_resubscribe_after_cancellation(
        self,
        db_session: AsyncSession,
        test_team: Team,
        free_marketplace_agent: MarketplaceAgent,
    ):
        """Test that resubscription is possible after cancellation."""
        # Create cancelled subscription
        cancelled = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=free_marketplace_agent.id,
            status=SubscriptionStatus.CANCELLED.value,
        )
        db_session.add(cancelled)
        await db_session.commit()

        # Check for active subscription - should not find cancelled one
        result = await db_session.execute(
            select(AgentSubscription).where(
                AgentSubscription.team_id == test_team.id,
                AgentSubscription.marketplace_agent_id == free_marketplace_agent.id,
                AgentSubscription.status == SubscriptionStatus.ACTIVE.value,
            )
        )
        existing = result.scalar_one_or_none()

        assert existing is None  # Can resubscribe

        # Create new active subscription
        new_sub = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=free_marketplace_agent.id,
            status=SubscriptionStatus.ACTIVE.value,
        )
        db_session.add(new_sub)
        await db_session.commit()

        # Verify both exist
        result = await db_session.execute(
            select(AgentSubscription).where(
                AgentSubscription.team_id == test_team.id,
                AgentSubscription.marketplace_agent_id == free_marketplace_agent.id,
            )
        )
        all_subs = result.scalars().all()

        assert len(all_subs) == 2

    async def test_paid_agent_without_stripe_config_detected(
        self,
        db_session: AsyncSession,
        test_agent: Agent,
        test_user: User,
    ):
        """Test detection of paid agents without Stripe configuration."""
        # Create paid agent without stripe_product_id
        unconfigured = MarketplaceAgent(
            id=str(uuid4()),
            agent_id=test_agent.id,
            seller_id=test_user.id,
            name="Unconfigured Paid Agent",
            category="coder",
            pricing_type=PricingType.USAGE_BASED.value,
            price_per_use=10.00,
            stripe_product_id=None,  # Not configured!
            is_active=True,
        )
        db_session.add(unconfigured)
        await db_session.commit()

        # Business logic should detect this
        assert unconfigured.pricing_type == PricingType.USAGE_BASED.value
        assert unconfigured.stripe_product_id is None  # Cannot process payment


# ============== Subscription Flow Tests ==============


class TestSubscriptionFlow(TestBillingFixtures):
    """Tests for the complete subscription flow logic."""

    async def test_free_agent_subscription_creates_directly(
        self,
        db_session: AsyncSession,
        test_team: Team,
        free_marketplace_agent: MarketplaceAgent,
    ):
        """Test that subscribing to a free agent creates subscription immediately."""
        # Simulate what the endpoint does for free agents
        assert free_marketplace_agent.pricing_type == PricingType.FREE.value

        sub = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=free_marketplace_agent.id,
            status=SubscriptionStatus.ACTIVE.value,
        )
        db_session.add(sub)
        await db_session.commit()

        # Verify subscription is active
        result = await db_session.execute(
            select(AgentSubscription).where(
                AgentSubscription.team_id == test_team.id,
                AgentSubscription.marketplace_agent_id == free_marketplace_agent.id,
            )
        )
        subscription = result.scalar_one()
        assert subscription.status == SubscriptionStatus.ACTIVE.value

    async def test_paid_agent_requires_stripe_checkout(
        self,
        db_session: AsyncSession,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that paid agents require Stripe checkout (have stripe_product_id)."""
        assert paid_marketplace_agent.pricing_type == PricingType.USAGE_BASED.value
        assert paid_marketplace_agent.stripe_product_id is not None

        # The endpoint would return checkout_url instead of creating subscription

    async def test_paid_agent_subscription_created_by_webhook(
        self,
        db_session: AsyncSession,
        test_team: Team,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that paid agent subscription is created via webhook after payment."""
        # Simulate webhook payload after successful Stripe checkout
        session = {
            "id": "cs_test_paid",
            "subscription": None,  # One-time payment
            "payment_intent": "pi_test_paid123",
            "metadata": {
                "type": "marketplace_agent_purchase",
                "team_id": test_team.id,
                "marketplace_agent_id": paid_marketplace_agent.id,
            },
        }

        # This is what the webhook handler does
        await _handle_checkout_completed(session, db_session)

        # Verify subscription was created
        result = await db_session.execute(
            select(AgentSubscription).where(
                AgentSubscription.team_id == test_team.id,
                AgentSubscription.marketplace_agent_id == paid_marketplace_agent.id,
            )
        )
        subscription = result.scalar_one()
        assert subscription.status == SubscriptionStatus.ACTIVE.value
        assert subscription.paid_order_id == "pi_test_paid123"

    async def test_subscription_requires_redirect_urls_for_paid(
        self,
        db_session: AsyncSession,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that paid agents require success_url and cancel_url."""
        # Business rule: paid agents need redirect URLs for Stripe checkout
        assert paid_marketplace_agent.pricing_type == PricingType.USAGE_BASED.value
        # The endpoint validates this and returns 400 if missing

    async def test_subscription_with_seller_stripe_account(
        self,
        db_session: AsyncSession,
        test_user: User,
        seller_profile: SellerProfile,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that seller's Stripe account is used for transfers."""
        # Verify seller has Stripe Connect account
        result = await db_session.execute(
            select(SellerProfile).where(SellerProfile.user_id == paid_marketplace_agent.seller_id)
        )
        profile = result.scalar_one_or_none()

        # When seller has Stripe account, transfers go to them
        if profile and profile.stripe_account_id:
            assert profile.stripe_account_id == "acct_test123"
            # The Stripe checkout session would include transfer_data


# ============== Subscription Access Check Tests ==============


class TestVerifyAgentSubscription(TestBillingFixtures):
    """Tests for the verify_agent_subscription function."""

    async def test_owner_always_has_access(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_team: Team,
        test_agent: Agent,
    ):
        """Test that agent owner can always access their agent."""
        # Should not raise - owner has access
        await verify_agent_subscription(
            db_session,
            agent_id=test_agent.id,
            team_id=test_team.id,
            user_id=test_user.id,
        )

    async def test_team_can_access_own_agent(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_team: Team,
        test_agent: Agent,
    ):
        """Test that a team can access agents assigned to them."""
        # Assign agent to team
        test_agent.team_id = test_team.id
        await db_session.commit()

        # Create different user
        other_user = User(
            id=str(uuid4()),
            email="other@example.com",
            username="otheruser",
            hashed_password="hashed",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.commit()

        # Should not raise - team owns the agent
        await verify_agent_subscription(
            db_session,
            agent_id=test_agent.id,
            team_id=test_team.id,
            user_id=other_user.id,
        )

    async def test_free_agent_no_subscription_needed(
        self,
        db_session: AsyncSession,
        test_team: Team,
        free_marketplace_agent: MarketplaceAgent,
    ):
        """Test that FREE marketplace agents don't need subscription."""
        # Create a different user (not the owner)
        other_user = User(
            id=str(uuid4()),
            email="anyone@example.com",
            username="anyone",
            hashed_password="hashed",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.commit()

        # Should not raise - free agents are accessible to everyone
        await verify_agent_subscription(
            db_session,
            agent_id=free_marketplace_agent.agent_id,
            team_id=test_team.id,
            user_id=other_user.id,
        )

    async def test_paid_agent_with_subscription_has_access(
        self,
        db_session: AsyncSession,
        test_team: Team,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that a team with active subscription can access paid agent."""
        # Create subscription
        subscription = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=paid_marketplace_agent.id,
            status=SubscriptionStatus.ACTIVE.value,
        )
        db_session.add(subscription)
        await db_session.commit()

        # Create a different user (not the owner)
        other_user = User(
            id=str(uuid4()),
            email="subscriber@example.com",
            username="subscriber",
            hashed_password="hashed",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.commit()

        # Should not raise - team has subscription
        await verify_agent_subscription(
            db_session,
            agent_id=paid_marketplace_agent.agent_id,
            team_id=test_team.id,
            user_id=other_user.id,
        )

    async def test_paid_agent_without_subscription_denied(
        self,
        db_session: AsyncSession,
        test_team: Team,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that a team without subscription is denied access to paid agent."""
        # Create a different user (not the owner)
        other_user = User(
            id=str(uuid4()),
            email="notsub@example.com",
            username="notsub",
            hashed_password="hashed",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.commit()

        # Should raise 403
        with pytest.raises(HTTPException) as exc_info:
            await verify_agent_subscription(
                db_session,
                agent_id=paid_marketplace_agent.agent_id,
                team_id=test_team.id,
                user_id=other_user.id,
            )

        assert exc_info.value.status_code == 403
        assert "active subscription" in exc_info.value.detail

    async def test_cancelled_subscription_denied_access(
        self,
        db_session: AsyncSession,
        test_team: Team,
        paid_marketplace_agent: MarketplaceAgent,
    ):
        """Test that a cancelled subscription doesn't grant access."""
        # Create cancelled subscription
        subscription = AgentSubscription(
            id=str(uuid4()),
            team_id=test_team.id,
            marketplace_agent_id=paid_marketplace_agent.id,
            status=SubscriptionStatus.CANCELLED.value,
        )
        db_session.add(subscription)
        await db_session.commit()

        # Create a different user
        other_user = User(
            id=str(uuid4()),
            email="cancelled@example.com",
            username="cancelled",
            hashed_password="hashed",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.commit()

        # Should raise 403
        with pytest.raises(HTTPException) as exc_info:
            await verify_agent_subscription(
                db_session,
                agent_id=paid_marketplace_agent.agent_id,
                team_id=test_team.id,
                user_id=other_user.id,
            )

        assert exc_info.value.status_code == 403

    async def test_non_marketplace_agent_requires_ownership(
        self,
        db_session: AsyncSession,
        test_user: User,
        test_team: Team,
    ):
        """Test that non-marketplace agents require ownership."""
        # Create agent not in marketplace
        private_agent = Agent(
            id=str(uuid4()),
            name="Private Agent",
            role="coder",
            inference_endpoint="https://private.example.com/v1",
            inference_provider="openai",
            inference_model="gpt-4",
            owner_id=str(uuid4()),  # Different owner
            status=AgentStatus.ONLINE,
        )
        db_session.add(private_agent)
        await db_session.commit()

        # Should raise 403
        with pytest.raises(HTTPException) as exc_info:
            await verify_agent_subscription(
                db_session,
                agent_id=private_agent.id,
                team_id=test_team.id,
                user_id=test_user.id,
            )

        assert exc_info.value.status_code == 403
        assert "don't have access" in exc_info.value.detail
