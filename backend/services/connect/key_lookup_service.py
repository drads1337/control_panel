"""
Key Lookup Service
Handles key lookup and validation in projects
Single Responsibility: Key lookup and basic validation
"""

import logging
from typing import Optional, Tuple

from ...models import Key, Project
from ...utils.service_exceptions import ValidationError, NotFoundError

logger = logging.getLogger(__name__)

class KeyLookupService:
    """Handles key lookup and validation"""

    def find_key_in_project(
        self, user_key: str, client_project_id: Optional[str]
    ) -> Tuple[Key, int]:
        """
        Find key in specified project

        Args:
            user_key: User key to find
            client_project_id: Project ID from client

        Returns:
            Tuple of (key_object, project_id)

        Raises:
            ValidationError: If project_id is missing or invalid
            NotFoundError: If project or key is not found
        """
        if not client_project_id:
            logger.warning(f"KEY_LOOKUP: Missing project_id")
            raise ValidationError(
                "Project ID is required for security validation",
                field="project_id"
            )

        try:
            logger.debug(
                f"KEY_LOOKUP: user_key={user_key}, client_project_id={client_project_id}"
            )

            project = Project.query.filter_by(unique_id=str(client_project_id)).first()
            if project:
                logger.debug(
                    f"KEY_LOOKUP: Found project by unique_id: id={project.id}, unique_id={project.unique_id}"
                )
            else:
                try:
                    project_id_int = int(client_project_id)
                    project = Project.query.get(project_id_int)
                    if project:
                        logger.debug(
                            f"KEY_LOOKUP: Found project by id: id={project.id}, unique_id={project.unique_id}"
                        )
                except (ValueError, TypeError) as e:
                    logger.warning(
                        f"KEY_LOOKUP: Invalid project_id format: {client_project_id}, error={e}"
                    )
                    pass

            if not project:
                logger.warning(
                    f"KEY_LOOKUP: Project not found for project_id={client_project_id}"
                )
                raise NotFoundError("Project", resource_id=str(client_project_id))

            key_obj = Key.query.filter_by(key=user_key, project_id=project.id).first()
            if key_obj:
                logger.debug(
                    f"KEY_LOOKUP: Key found: key={user_key}, project_id={project.id}, status={key_obj.status}"
                )
            else:
                logger.warning(
                    f"KEY_LOOKUP: Key not found: key={user_key}, project_id={project.id}"
                )

                key_anywhere = Key.query.filter_by(key=user_key).first()
                if key_anywhere:
                    logger.warning(
                        f"KEY_LOOKUP: Key exists but in different project: key={user_key}, actual_project_id={key_anywhere.project_id}, requested_project_id={project.id}"
                    )

            if not key_obj:
                raise NotFoundError("Key", resource_id=user_key)

            return key_obj, project.id

        except (ValidationError, NotFoundError):

            raise
        except (ValueError, TypeError) as e:
            logger.error(f"KEY_LOOKUP: Invalid project_id format: {client_project_id}, error={e}")
            raise ValidationError(
                f"Invalid project ID format: {client_project_id}",
                field="project_id"
            ) from e
        except Exception as e:
            logger.error(f"KEY_LOOKUP: Key lookup error: {e}")
            import traceback
            logger.error(f"KEY_LOOKUP_TRACEBACK: {traceback.format_exc()}")
            raise ValidationError(
                "Invalid project ID format",
                field="project_id"
            ) from e
