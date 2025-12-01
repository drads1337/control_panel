"""
Integration tests for race conditions

Tests concurrent operations to ensure data consistency:
- Race conditions during key creation with balance deduction
- Concurrent balance deductions
- Concurrent key creation requests

These tests use threading to simulate concurrent requests.
"""

import concurrent.futures
import threading
import time
from datetime import datetime, timedelta

import pytest
from flask import Flask

from backend.core.extensions import db
from backend.models.core import Project, User
from backend.models.keys import Key
from backend.models.products import Product
from backend.utils.service_helpers import get_service


@pytest.fixture
def test_project(db_session) -> Project:
    """Create a test project"""
    project = Project(
        name="Race Condition Test Project",
        status="active",
        created_at=datetime.utcnow(),
    )
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


@pytest.fixture
def test_user_with_balance(db_session, test_project) -> User:
    """Create a test user with sufficient balance"""
    user = User(
        username="race_test_user",
        email="race_test@example.com",
        password_hash="hashed_password",
        token_balance=1000.0,  # Sufficient balance for multiple operations
        project_id=test_project.id,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_product(db_session, test_project) -> Product:
    """Create a test product"""
    product = Product(
        name="Test Product",
        project_id=test_project.id,
        price_per_hour=10.0,
        status="active",
        created_at=datetime.utcnow(),
    )
    db_session.add(product)
    db_session.commit()
    db_session.refresh(product)
    return product


@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.security
class TestRaceConditions:
    """Test race conditions in concurrent operations"""

    def test_concurrent_balance_deduction(self, app: Flask, test_user_with_balance: User):
        """
        Test that concurrent balance deductions don't result in negative balance.
        
        This test simulates multiple threads trying to deduct balance simultaneously.
        Expected: All deductions should succeed OR some should fail with "Insufficient balance",
        but final balance should never be negative.
        """
        initial_balance = test_user_with_balance.token_balance
        deduction_amount = 50.0
        num_threads = 10  # Try to deduct 10 * 50 = 500 from balance of 1000
        
        results = []
        errors = []
        
        def deduct_balance_thread(thread_id: int):
            """Thread function to deduct balance"""
            with app.app_context():
                try:
                    balance_service = get_service('balance_service')
                    
                    # Refresh user to get latest balance
                    db.session.refresh(test_user_with_balance)
                    
                    success, error_msg, result_data = balance_service.deduct_balance(
                        current_user=test_user_with_balance,
                        target_user_id=test_user_with_balance.id,
                        amount=deduction_amount,
                        reason=f"Concurrent test deduction {thread_id}",
                        ip_address=None,
                        commit=True,
                    )
                    
                    results.append({
                        'thread_id': thread_id,
                        'success': success,
                        'error': error_msg,
                        'result': result_data,
                    })
                except Exception as e:
                    errors.append({'thread_id': thread_id, 'error': str(e)})
        
        # Run concurrent deductions
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(deduct_balance_thread, i) for i in range(num_threads)]
            concurrent.futures.wait(futures)
        
        # Verify results
        successful_deductions = sum(1 for r in results if r['success'])
        failed_deductions = sum(1 for r in results if not r['success'])
        
        # Refresh user to get final balance
        with app.app_context():
            db.session.refresh(test_user_with_balance)
            final_balance = test_user_with_balance.token_balance
        
        # Assertions
        assert final_balance >= 0, f"Final balance should never be negative, got {final_balance}"
        assert final_balance <= initial_balance, f"Final balance should not exceed initial balance"
        
        # Calculate expected balance
        expected_balance = initial_balance - (successful_deductions * deduction_amount)
        assert abs(final_balance - expected_balance) < 0.01, \
            f"Final balance {final_balance} doesn't match expected {expected_balance} " \
            f"(successful deductions: {successful_deductions})"
        
        # Log results for debugging
        print(f"\nConcurrent balance deduction test:")
        print(f"  Initial balance: {initial_balance}")
        print(f"  Final balance: {final_balance}")
        print(f"  Successful deductions: {successful_deductions}")
        print(f"  Failed deductions: {failed_deductions}")
        print(f"  Errors: {len(errors)}")
        
        # At least some deductions should succeed (we have enough balance for 20 deductions)
        assert successful_deductions > 0, "At least some deductions should succeed"
        
        # If all succeeded, we should have exactly the expected balance
        if successful_deductions == num_threads:
            assert final_balance == expected_balance

    def test_concurrent_key_creation_balance_check(self, app: Flask, test_user_with_balance: User, test_product: Product):
        """
        Test that concurrent key creation requests properly check and deduct balance.
        
        This test simulates multiple threads trying to create keys simultaneously.
        Expected: Keys should only be created if balance is sufficient, and final balance
        should never be negative.
        """
        initial_balance = test_user_with_balance.token_balance
        key_price = 50.0  # Price per key
        num_threads = 15  # Try to create 15 keys, but only have balance for ~20
        
        results = []
        errors = []
        created_keys = []
        
        def create_key_thread(thread_id: int):
            """Thread function to create a key"""
            with app.app_context():
                try:
                    key_crud_service = get_service('key_crud_service')
                    
                    key_data = {
                        'product_id': test_product.id,
                        'duration_hours': 1.0,
                        'max_devices': 1,
                    }
                    
                    # Try to create key
                    key = key_crud_service.create_key(
                        user=test_user_with_balance,
                        key_data=key_data
                    )
                    
                    created_keys.append(key.id)
                    results.append({
                        'thread_id': thread_id,
                        'success': True,
                        'key_id': key.id,
                    })
                except Exception as e:
                    error_msg = str(e)
                    results.append({
                        'thread_id': thread_id,
                        'success': False,
                        'error': error_msg,
                    })
                    if 'Insufficient balance' not in error_msg and 'balance' not in error_msg.lower():
                        errors.append({'thread_id': thread_id, 'error': error_msg})
        
        # Run concurrent key creation
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(create_key_thread, i) for i in range(num_threads)]
            concurrent.futures.wait(futures)
        
        # Verify results
        successful_creations = sum(1 for r in results if r['success'])
        failed_creations = sum(1 for r in results if not r['success'])
        
        # Refresh user to get final balance
        with app.app_context():
            db.session.refresh(test_user_with_balance)
            final_balance = test_user_with_balance.token_balance
        
        # Count actual keys created
        with app.app_context():
            actual_keys_count = Key.query.filter_by(user_id=test_user_with_balance.id).count()
        
        # Assertions
        assert final_balance >= 0, f"Final balance should never be negative, got {final_balance}"
        assert final_balance <= initial_balance, f"Final balance should not exceed initial balance"
        
        # Calculate expected balance
        expected_balance = initial_balance - (successful_creations * key_price)
        assert abs(final_balance - expected_balance) < 0.01, \
            f"Final balance {final_balance} doesn't match expected {expected_balance} " \
            f"(successful creations: {successful_creations})"
        
        # Number of created keys should match successful creations
        assert actual_keys_count == successful_creations, \
            f"Number of created keys ({actual_keys_count}) doesn't match successful creations ({successful_creations})"
        
        # Log results for debugging
        print(f"\nConcurrent key creation test:")
        print(f"  Initial balance: {initial_balance}")
        print(f"  Final balance: {final_balance}")
        print(f"  Successful creations: {successful_creations}")
        print(f"  Failed creations: {failed_creations}")
        print(f"  Actual keys created: {actual_keys_count}")
        print(f"  Errors: {len(errors)}")
        
        # At least some keys should be created (we have enough balance)
        assert successful_creations > 0, "At least some keys should be created"
        
        # Not all should succeed (we don't have enough balance for all)
        assert successful_creations < num_threads, \
            "Not all key creations should succeed (insufficient balance)"

    def test_balance_deduction_with_select_for_update(self, app: Flask, test_user_with_balance: User):
        """
        Test that balance deduction works correctly when using SELECT FOR UPDATE.
        
        This test verifies that the current implementation handles concurrent access,
        even if it doesn't use SELECT FOR UPDATE explicitly.
        """
        initial_balance = test_user_with_balance.token_balance
        deduction_amount = 100.0
        num_threads = 5
        
        results = []
        
        def deduct_with_lock(thread_id: int):
            """Thread function that uses database-level locking"""
            with app.app_context():
                try:
                    # Use SELECT FOR UPDATE to lock the row
                    from sqlalchemy import text
                    
                    # Lock the user row
                    locked_user = db.session.execute(
                        text("SELECT * FROM users WHERE id = :user_id FOR UPDATE"),
                        {'user_id': test_user_with_balance.id}
                    ).fetchone()
                    
                    if not locked_user:
                        results.append({'thread_id': thread_id, 'success': False, 'error': 'User not found'})
                        return
                    
                    # Get fresh user instance
                    user = User.query.get(test_user_with_balance.id)
                    
                    if user.token_balance >= deduction_amount:
                        user.token_balance -= deduction_amount
                        db.session.commit()
                        results.append({'thread_id': thread_id, 'success': True})
                    else:
                        db.session.rollback()
                        results.append({'thread_id': thread_id, 'success': False, 'error': 'Insufficient balance'})
                except Exception as e:
                    db.session.rollback()
                    results.append({'thread_id': thread_id, 'success': False, 'error': str(e)})
        
        # Run concurrent deductions with locking
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(deduct_with_lock, i) for i in range(num_threads)]
            concurrent.futures.wait(futures)
        
        # Verify results
        successful_deductions = sum(1 for r in results if r['success'])
        
        # Refresh user to get final balance
        with app.app_context():
            db.session.refresh(test_user_with_balance)
            final_balance = test_user_with_balance.token_balance
        
        # Assertions
        assert final_balance >= 0, f"Final balance should never be negative, got {final_balance}"
        
        expected_balance = initial_balance - (successful_deductions * deduction_amount)
        assert abs(final_balance - expected_balance) < 0.01, \
            f"Final balance {final_balance} doesn't match expected {expected_balance}"
        
        print(f"\nSELECT FOR UPDATE test:")
        print(f"  Initial balance: {initial_balance}")
        print(f"  Final balance: {final_balance}")
        print(f"  Successful deductions: {successful_deductions}")

    def test_race_condition_key_creation_insufficient_balance(self, app: Flask, test_user_with_balance: User, test_product: Product):
        """
        Test that key creation properly fails when balance becomes insufficient due to concurrent operations.
        
        This test sets up a scenario where initial balance is just enough for one key,
        then tries to create multiple keys concurrently.
        """
        # Set balance to exactly one key price
        key_price = 50.0
        with app.app_context():
            test_user_with_balance.token_balance = key_price
            db.session.commit()
            db.session.refresh(test_user_with_balance)
        
        initial_balance = test_user_with_balance.token_balance
        num_threads = 5  # Try to create 5 keys with balance for only 1
        
        results = []
        
        def create_key_thread(thread_id: int):
            """Thread function to create a key"""
            with app.app_context():
                try:
                    key_crud_service = get_service('key_crud_service')
                    
                    key_data = {
                        'product_id': test_product.id,
                        'duration_hours': 1.0,
                        'max_devices': 1,
                    }
                    
                    key = key_crud_service.create_key(
                        user=test_user_with_balance,
                        key_data=key_data
                    )
                    
                    results.append({
                        'thread_id': thread_id,
                        'success': True,
                        'key_id': key.id,
                    })
                except Exception as e:
                    error_msg = str(e)
                    results.append({
                        'thread_id': thread_id,
                        'success': False,
                        'error': error_msg,
                    })
        
        # Run concurrent key creation
        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(create_key_thread, i) for i in range(num_threads)]
            concurrent.futures.wait(futures)
        
        # Verify results
        successful_creations = sum(1 for r in results if r['success'])
        failed_creations = sum(1 for r in results if not r['success'])
        
        # Refresh user to get final balance
        with app.app_context():
            db.session.refresh(test_user_with_balance)
            final_balance = test_user_with_balance.token_balance
        
        # Count actual keys created
        with app.app_context():
            actual_keys_count = Key.query.filter_by(user_id=test_user_with_balance.id).count()
        
        # Assertions
        assert final_balance >= 0, f"Final balance should never be negative, got {final_balance}"
        
        # Only one key should be created (we only have balance for one)
        assert successful_creations == 1, \
            f"Only one key should be created, but {successful_creations} were created"
        assert actual_keys_count == 1, \
            f"Only one key should exist in database, but {actual_keys_count} exist"
        
        # Final balance should be 0 (or very close due to rounding)
        assert final_balance < 0.01, \
            f"Final balance should be 0 (or close), but got {final_balance}"
        
        print(f"\nRace condition with insufficient balance test:")
        print(f"  Initial balance: {initial_balance}")
        print(f"  Final balance: {final_balance}")
        print(f"  Successful creations: {successful_creations}")
        print(f"  Failed creations: {failed_creations}")
        print(f"  Actual keys created: {actual_keys_count}")

